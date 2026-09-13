import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const INTERNAL_SECRET = process.env.AGENT_SERVICE_SHARED_SECRET;

function checkInternalAuth(request: Request) {
  if (!INTERNAL_SECRET) return true;
  const header = request.headers.get("X-Axiom-Internal-Secret");
  return header === INTERNAL_SECRET;
}

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
