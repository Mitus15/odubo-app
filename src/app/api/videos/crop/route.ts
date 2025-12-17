import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url: string };

    if (!url) {
      return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
    }

    console.log('[Crop API] Starting crop for:', url);

    // Create a PassThrough stream to pipe the output
    const passThrough = new PassThrough();

    // Run ffmpeg
    // We rely on system ffmpeg (v8.0 installed)
    const command = ffmpeg(url)
      .format('mp4')
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-movflags frag_keyframe+empty_moov', // Essential for streaming MP4
        '-vf crop=trunc(ih*9/16/2)*2:ih:(iw-ow)/2:0', // Center crop to 9:16, width divisible by 2
        // Audio loudness normalization to -16 LUFS (Apple Music standard)
        '-af loudnorm=I=-16:TP=-1.5:LRA=11',
        '-preset ultrafast', // Fast processing
        '-crf 23' // Reasonable quality
      ])
      .on('start', (cmd) => {
        console.log('[Crop API] FFmpeg command:', cmd);
      })
      .on('error', (err) => {
        console.error('[Crop API] FFmpeg error:', err);
        // If headers haven't been sent, we could send a 500, but with streaming it's hard.
        // We'll log it. The client stream will likely end abruptly.
      })
      .on('end', () => {
        console.log('[Crop API] FFmpeg processing finished');
      });

    // Pipe to response
    command.pipe(passThrough);

    // Return the stream
    return new NextResponse(passThrough as any, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="cropped_clip.mp4"',
      },
    });

  } catch (error: any) {
    console.error('[Crop API] Handler Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
