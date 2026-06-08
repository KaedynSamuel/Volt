import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    { error: "Joining by access code has been removed. Ask your admin to create your account in the Team page." },
    { status: 410 }
  )
}
