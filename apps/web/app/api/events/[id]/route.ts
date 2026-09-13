import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkInternalAuth } from "@/lib/internalAuth";
import { errorMessage } from "@/lib/errors";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!checkInternalAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.event.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
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
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
