// casper-voice-web/tests/update_routes.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";
import { NextRequest } from "next/server";
import { PUT as updateAppointment, DELETE as deleteAppointment } from "../app/api/appointments/route";
import { PUT as updateExpense } from "../app/api/expenses/route";
import { PUT as updatePurchase } from "../app/api/purchases/route";

const prisma = new PrismaClient();

if (!process.env.INTERNAL_API_KEY) {
  process.env.INTERNAL_API_KEY = "test-internal-secret-key-123";
}
const VALID_TOKEN = process.env.INTERNAL_API_KEY;

function makePutRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("Update Routes Test Suite", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("[Group 1] G3: Decimal.js Precision", () => {
    it("G3.1: Decimal.js exact subtraction", () => {
      const total = new Decimal(1000.55);
      const paid = new Decimal(300.25);
      const deferred = Decimal.max(0, total.minus(paid));
      expect(deferred.toNumber()).toBe(700.3);
    });
  });

  describe("[Group 2] G2: 404 Fallback Tests", () => {
    it("G2.1 & G2.2: Appointments 404 fallback", async () => {
      const req = makePutRequest(
        "http://localhost/api/appointments",
        { customer_name: "عميل غير موجود قطعاً 999", new_date: "2026-08-01" },
        { Authorization: `Bearer ${VALID_TOKEN}` }
      );
      const res = await updateAppointment(req);
      const json = await res.json();
      expect(res.status).toBe(404);
      expect(typeof json.error).toBe("string");
    });

    it("G2.3 & G2.4: Expenses 404 fallback", async () => {
      const req = makePutRequest(
        "http://localhost/api/expenses",
        { description: "مصروف وهمي غير موجود 999", new_amount: 50 },
        { Authorization: `Bearer ${VALID_TOKEN}` }
      );
      const res = await updateExpense(req);
      const json = await res.json();
      expect(res.status).toBe(404);
      expect(typeof json.error).toBe("string");
    });
  });

  describe("[Group 3] G6: Auth Rejection Checks Across All Routes", () => {
    it("G6.1 & G6.2: Appointments Auth checks", async () => {
      const req1 = makePutRequest("http://localhost/api/appointments", { customer_name: "اختبار" });
      const res1 = await updateAppointment(req1);
      expect(res1.status).toBe(401);

      const req2 = makePutRequest(
        "http://localhost/api/appointments",
        { customer_name: "اختبار" },
        { Authorization: "Bearer wrong-token-key" }
      );
      const res2 = await updateAppointment(req2);
      expect(res2.status).toBe(401);
    });

    it("G6.3 & G6.4: Expenses Auth checks", async () => {
      const req1 = makePutRequest("http://localhost/api/expenses", { description: "بنزين", new_amount: 150 });
      const res1 = await updateExpense(req1);
      expect(res1.status).toBe(401);

      const req2 = makePutRequest(
        "http://localhost/api/expenses",
        { description: "بنزين", new_amount: 150 },
        { Authorization: "Bearer wrong-token-key" }
      );
      const res2 = await updateExpense(req2);
      expect(res2.status).toBe(401);
    });

    it("G6.5 & G6.6: Purchases Auth checks", async () => {
      const req1 = makePutRequest("http://localhost/api/purchases", { supplier_name: "مورد", payment_amount: 50 });
      const res1 = await updatePurchase(req1);
      expect(res1.status).toBe(401);

      const req2 = makePutRequest(
        "http://localhost/api/purchases",
        { supplier_name: "مورد", payment_amount: 50 },
        { Authorization: "Bearer wrong-token-key" }
      );
      const res2 = await updatePurchase(req2);
      expect(res2.status).toBe(401);
    });
  });

  describe("[Group 4] G1: Disambiguation Candidate List", () => {
    it("G1.1 - G1.3: Appointment Disambiguation", async () => {
      const appt1 = await prisma.appointment.create({
        data: { customerName: "عميل تكرار موثق", date: "2026-08-01", time: "10:00", notes: "اختبار 1" },
      });
      const appt2 = await prisma.appointment.create({
        data: { customerName: "عميل تكرار موثق", date: "2026-08-02", time: "14:00", notes: "اختبار 2" },
      });

      const req = makePutRequest(
        "http://localhost/api/appointments",
        { customer_name: "عميل تكرار موثق", new_time: "15:00" },
        { Authorization: `Bearer ${VALID_TOKEN}` }
      );
      const res = await updateAppointment(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.ambiguous).toBe(true);
      expect(Array.isArray(json.candidates)).toBe(true);
      expect(json.candidates.length).toBe(2);

      // Clean up
      await prisma.appointment.deleteMany({ where: { id: { in: [appt1.id, appt2.id] } } });
    });
  });

  describe("[Group 5] G4: Idempotency-Key Cache Guards", () => {
    it("G4.1 & G4.2: Purchases Idempotency Cache Guard", async () => {
      const supplier = await prisma.supplier.upsert({
        where: { name: "مورد تجارب ألي" },
        update: {},
        create: { name: "مورد تجارب ألي" },
      });
      const purchase = await prisma.purchase.create({
        data: {
          supplierId: supplier.id,
          itemName: "صنف اختبار idempotency",
          totalAmount: 1000,
          paidAmount: 200,
          deferredAmount: 800,
          notes: "اختبار",
        },
      });

      const idempotencyKeyPurch = `test-uuid-purch-${Date.now()}`;
      const payPayload = { supplier_name: "مورد تجارب ألي", payment_amount: 100 };

      const req1 = makePutRequest("http://localhost/api/purchases", payPayload, {
        Authorization: `Bearer ${VALID_TOKEN}`,
        "idempotency-key": idempotencyKeyPurch,
      });
      const res1 = await updatePurchase(req1);
      const json1 = await res1.json();

      const req2 = makePutRequest("http://localhost/api/purchases", payPayload, {
        Authorization: `Bearer ${VALID_TOKEN}`,
        "idempotency-key": idempotencyKeyPurch,
      });
      const res2 = await updatePurchase(req2);
      const json2 = await res2.json();

      expect(json2.cached).toBe(true);
      expect(json2.remainingDebt).toBe(json1.remainingDebt);

      await prisma.purchase.delete({ where: { id: purchase.id } });
    });

    it("G4.3: Appointments Idempotency Cache Guard", async () => {
      const appt = await prisma.appointment.create({
        data: { customerName: "عميل ايدمبوتنسي", date: "2026-08-05", time: "11:00" },
      });

      const idempotencyKeyAppt = `test-uuid-appt-${Date.now()}`;
      const apptPayload = { id: appt.id, new_time: "16:00" };

      const req1 = makePutRequest("http://localhost/api/appointments", apptPayload, {
        Authorization: `Bearer ${VALID_TOKEN}`,
        "idempotency-key": idempotencyKeyAppt,
      });
      await updateAppointment(req1);

      const req2 = makePutRequest("http://localhost/api/appointments", apptPayload, {
        Authorization: `Bearer ${VALID_TOKEN}`,
        "idempotency-key": idempotencyKeyAppt,
      });
      const res2 = await updateAppointment(req2);
      const json2 = await res2.json();

      expect(json2.cached).toBe(true);

      await prisma.appointment.delete({ where: { id: appt.id } });
    });
  });

  describe("[Group 6] G5: Optimistic Concurrency Conflict", () => {
    it("G5.1 & G5.2: Optimistic Concurrency Check (updatedAt mismatch)", async () => {
      const appt = await prisma.appointment.create({
        data: { customerName: "عميل تضارب", date: "2026-08-05", time: "11:00" },
      });

      const staleUpdatedAt = "2020-01-01T00:00:00.000Z";
      const req = makePutRequest(
        "http://localhost/api/appointments",
        { id: appt.id, new_date: "2026-08-10", updatedAt: staleUpdatedAt },
        { Authorization: `Bearer ${VALID_TOKEN}` }
      );
      const res = await updateAppointment(req);
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.conflict).toBe(true);

      await prisma.appointment.delete({ where: { id: appt.id } });
    });
  });

  describe("[Group 7] G7: Appointment Cancellation (DELETE)", () => {
    it("G7.1 & G7.2: Appointment Cancellation (DELETE)", async () => {
      const appt = await prisma.appointment.create({
        data: { customerName: "عميل إلغاء", date: "2026-08-05", time: "11:00" },
      });

      const reqDelete = new NextRequest("http://localhost/api/appointments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${VALID_TOKEN}` },
        body: JSON.stringify({ id: appt.id }),
      });
      const resDelete = await deleteAppointment(reqDelete);
      const jsonDelete = await resDelete.json();

      expect(resDelete.status).toBe(200);
      expect(jsonDelete.success).toBe(true);
    });
  });
});
