import { prisma } from "@/lib/prisma";
// app/api/appointments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fireAndForgetTelegramAlert } from "@/lib/telegram";
import { getResolvedTenantId, isInternalAuthValid } from "@/lib/auth";
import { runWithTenant } from "@/lib/prisma-tenant-extension";


export async function POST(req: NextRequest) {
  try {
    const resolvedTenantId = await getResolvedTenantId(req);
    if (!resolvedTenantId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { customer_name, date, time, notes } = body;

    if (!customer_name || !date || !time) {
      return NextResponse.json(
        { error: "customer_name و date و time مطلوبين" },
        { status: 400 }
      );
    }

    // Appointment Conflict Guard: Check for existing appointment at same date & time for this tenant
    const existing = await prisma.appointment.findFirst({
      where: {
        date: { contains: date.trim() },
        time: { contains: time.trim() },
        tenantId: resolvedTenantId,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          conflict: true,
          error: `فيه ميعاد محجوز بالفعل في الموعد ده لـ (${existing.customerName})`,
          existingCustomer: existing.customerName,
        },
        { status: 409 }
      );
    }

    const appointment = await prisma.appointment.create({
      data: {
        customerName: customer_name.trim(),
        date: date.trim(),
        time: time.trim(),
        notes: notes || "",
        tenantId: resolvedTenantId,
      },
    });

    const targetChatId = process.env.TELEGRAM_CHAT_ID || "";
    if (targetChatId) {
      fireAndForgetTelegramAlert({
        chatId: targetChatId,
        text: `📅 *تم حجز ميعاد جديد عبر Voice Agent!*\n\n👤 *العميل:* ${appointment.customerName}\n📆 *التاريخ:* ${appointment.date}\n⏰ *الوقت:* ${appointment.time}\n📝 *ملاحظات:* ${appointment.notes || "لا يوجد"}`,
        idempotencyKey: `appointment:${appointment.id}`,
      });
    }

    return NextResponse.json({ success: true, appointment });
  } catch (err) {
    console.error("[Appointments POST Error]", err);
    return NextResponse.json({ error: "حصل خطأ في حجز الميعاد" }, { status: 500 });
  }

}

export async function GET(req: NextRequest) {
  const sessionTenantId = await getResolvedTenantId(req);
  const queryTenantId = req.nextUrl.searchParams.get("tenantId");

  const effectiveTenantId = queryTenantId ?? sessionTenantId;
  const where: any = {};
  if (effectiveTenantId && effectiveTenantId !== "all") {
    where.tenantId = effectiveTenantId;
  }

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ appointments });
}

const appointmentIdempotencyMap = new Map<string, { timestamp: number; response: any }>();

export async function PUT(req: NextRequest) {
  try {
    if (!isInternalAuthValid(req)) {
      return NextResponse.json({ error: "غير مصرح (Unauthorized)" }, { status: 401 });
    }
    const resolvedTenantId = await getResolvedTenantId(req);
    if (!resolvedTenantId) {
      return NextResponse.json({ error: "غير مصرح (Missing Tenant ID)" }, { status: 401 });
    }

    return await runWithTenant(resolvedTenantId, async () => {
      // G4: Idempotency-Key check for Appointments
      const idempotencyKey = req.headers.get("idempotency-key");
      const now = Date.now();
      if (idempotencyKey) {
        const cached = appointmentIdempotencyMap.get(idempotencyKey);
        if (cached && now - cached.timestamp < 60000) {
          return NextResponse.json({ ...cached.response, cached: true });
        }
      }

      const { id, customer_name, new_date, new_time, current_date, notes, status, updatedAt } = await req.json();

      // Direct update by ID if known
      if (id) {
        const existing = await prisma.appointment.findUnique({ where: { id } });
        if (!existing) {
          return NextResponse.json({ error: "الميعاد غير موجود" }, { status: 404 });
        }

        // G5: Optimistic Concurrency Check
        if (updatedAt && existing.updatedAt.toISOString() !== updatedAt) {
          return NextResponse.json(
            { success: false, conflict: true, error: "تم تعديل الميعاد بواسطة مستخدم آخر. يرجى إعادة التحميل." },
            { status: 409 }
          );
        }

        const updated = await prisma.appointment.update({
          where: { id },
          data: {
            ...(new_date && { date: new_date.trim() }),
            ...(new_time && { time: new_time.trim() }),
            ...(notes && { notes: notes.trim() }),
            ...(status && { status: status.trim() }),
          },
        });
        const resPayload = { success: true, updated };
        if (idempotencyKey) appointmentIdempotencyMap.set(idempotencyKey, { timestamp: now, response: resPayload });
        return NextResponse.json(resPayload);
      }

      if (!customer_name) {
        return NextResponse.json({ error: "يلزم تحديد اسم العميل أو المعرف (ID)" }, { status: 400 });
      }

      // Search for appointments matching customer_name
      let matches = await prisma.appointment.findMany({
        where: {
          customerName: { contains: customer_name.trim() },
        },
        orderBy: { createdAt: "desc" },
      });

      if (matches.length === 0) {
        return NextResponse.json(
          { error: `عفواً، مفيش أي ميعاد مسجل باسم (${customer_name}) للتعديل.` },
          { status: 404 }
        );
      }

      // If current_date is provided, narrow down matches
      if (current_date && matches.length > 1) {
        const filtered = matches.filter((m) => m.date.includes(current_date.trim()));
        if (filtered.length > 0) matches = filtered;
      }

      // Multi-match Disambiguation
      if (matches.length > 1) {
        const candidates = matches.map((m) => ({
          id: m.id,
          customerName: m.customerName,
          date: m.date,
          time: m.time,
          notes: m.notes,
          updatedAt: m.updatedAt.toISOString(),
        }));
        return NextResponse.json(
          {
            ambiguous: true,
            count: matches.length,
            message: `فيه ${matches.length} مواعيد مسجلة لـ ${customer_name}. يرجى تحديد أي ميعاد للتعديل.`,
            candidates,
          },
          { status: 400 }
        );
      }

      // Single match found: update
      const target = matches[0];

      // G5: Optimistic Concurrency Check
      if (updatedAt && target.updatedAt.toISOString() !== updatedAt) {
        return NextResponse.json(
          { success: false, conflict: true, error: "تم تعديل الميعاد بواسطة مستخدم آخر. يرجى إعادة التحميل." },
          { status: 409 }
        );
      }

      const updated = await prisma.appointment.update({
        where: { id: target.id },
        data: {
          ...(new_date && { date: new_date.trim() }),
          ...(new_time && { time: new_time.trim() }),
          ...(notes && { notes: notes.trim() }),
          ...(status && { status: status.trim() }),
        },
      });

      const responsePayload = {
        success: true,
        oldDate: target.date,
        oldTime: target.time,
        updated,
      };

      if (idempotencyKey) {
        appointmentIdempotencyMap.set(idempotencyKey, { timestamp: now, response: responsePayload });
      }

      return NextResponse.json(responsePayload);
    });
  } catch (err) {
    console.error("[Appointments PUT Error]", err);
    return NextResponse.json({ error: "حصل خطأ في تعديل الميعاد" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!isInternalAuthValid(req)) {
      return NextResponse.json({ error: "غير مصرح (Unauthorized)" }, { status: 401 });
    }
    const resolvedTenantId = await getResolvedTenantId(req);
    if (!resolvedTenantId) {
      return NextResponse.json({ error: "غير مصرح (Missing Tenant ID)" }, { status: 401 });
    }

    return await runWithTenant(resolvedTenantId, async () => {
      const { id, customer_name, date } = await req.json();

      if (id) {
        const deleted = await prisma.appointment.delete({ where: { id } });
        return NextResponse.json({ success: true, deleted });
      }

      if (!customer_name) {
        return NextResponse.json({ error: "يلزم اسم العميل أو المعرف (ID) لإلغاء الميعاد" }, { status: 400 });
      }

      let matches = await prisma.appointment.findMany({
        where: { customerName: { contains: customer_name.trim() } },
        orderBy: { createdAt: "desc" },
      });

      if (matches.length === 0) {
        return NextResponse.json({ error: `عفواً، مفيش أي ميعاد مسجل باسم (${customer_name}) للإلغاء.` }, { status: 404 });
      }

      if (date && matches.length > 1) {
        const filtered = matches.filter((m) => m.date.includes(date.trim()));
        if (filtered.length > 0) matches = filtered;
      }

      const target = matches[0];
      const deleted = await prisma.appointment.delete({ where: { id: target.id } });

      return NextResponse.json({
        success: true,
        message: `تم إلغاء ميعاد ${target.customerName} (يوم ${target.date} الساعة ${target.time}) بنجاح.`,
        deleted,
      });
    });
  } catch (err) {
    console.error("[Appointments DELETE Error]", err);
    return NextResponse.json({ error: "حصل خطأ في إلغاء الميعاد" }, { status: 500 });
  }
}

