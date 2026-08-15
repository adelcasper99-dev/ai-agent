import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSupplierSchema = z.object({
  name: z.string().min(1, "اسم المورد مطلوب").optional(),
  phone: z.string().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateSupplierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone.trim() } : {}),
      },
    });

    return NextResponse.json({ success: true, supplier: updated });
  } catch (err: any) {
    console.error("[Update Supplier Error]", err);
    return NextResponse.json(
      { error: err?.message || "فشل في تحديث بيانات المورد" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Perform cascading cleanup inside transaction if necessary
    await (prisma as any).$transaction(async (tx: any) => {
      await tx.purchase.deleteMany({ where: { supplierId: id } });
      await tx.supplierPayment.deleteMany({ where: { supplierId: id } });
      await tx.supplier.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Delete Supplier Error]", err);
    return NextResponse.json(
      { error: err?.message || "فشل في حذف المورد" },
      { status: 500 }
    );
  }
}
