import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    { error: "Access codes have been removed. Admins now create users directly from the Team page." },
    { status: 410 }
  )
}

export async function POST() {
  return NextResponse.json(
    { error: "Access codes have been removed. Admins now create users directly from the Team page." },
    { status: 410 }
  )
}
