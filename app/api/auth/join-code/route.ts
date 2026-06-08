import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    { error: "Access-code lookup has been removed. Admins now create users directly from the Team page." },
    { status: 410 }
  )
}
