import { NextRequest, NextResponse } from "next/server";

const ALLOWED_IMAGE_HOSTS = new Set(["res.cloudinary.com"]);

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) return NextResponse.json({ error: "Image URL is required." }, { status: 400 });

  let imageUrl: URL;
  try {
    imageUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid image URL." }, { status: 400 });
  }

  if (imageUrl.protocol !== "https:" || !ALLOWED_IMAGE_HOSTS.has(imageUrl.hostname)) {
    return NextResponse.json({ error: "Image host is not allowed." }, { status: 403 });
  }

  try {
    const response = await fetch(imageUrl, { next: { revalidate: 86400 } });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Image could not be loaded." }, { status: 502 });
    }
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image could not be loaded." }, { status: 502 });
  }
}
