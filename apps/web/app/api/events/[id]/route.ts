import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkInternalAuth } from "@/lib/internalAuth";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!checkInternalAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { processed, previousState, newState } = body;

    const event = await prisma.event.update({
      where: { id: params.id },
      data: {
        ...(typeof processed === "boolean" ? { processed } : {}),
        ...(previousState !== undefined ? { previousState } : {}),
        ...(newState !== undefined ? { newState } : {}),
      },
    });

    return NextResponse.json(event);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
