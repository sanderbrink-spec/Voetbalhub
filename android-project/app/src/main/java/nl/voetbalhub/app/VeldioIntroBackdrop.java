package nl.voetbalhub.app;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.View;
import android.view.animation.LinearInterpolator;

/**
 * Original subtle Veldio motion layer above the approved portrait bitmap.
 * It is transparent and stops when the splash disappears.
 */
final class VeldioIntroBackdrop extends View {
    private static final int GREEN = 0xFF25F06B;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    private ValueAnimator motion;
    private float phase;

    VeldioIntroBackdrop(Context context) {
        super(context);
        setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
    }

    void start() {
        if (motion != null) return;
        motion = ValueAnimator.ofFloat(0f, 1f);
        motion.setDuration(8500L);
        motion.setRepeatCount(ValueAnimator.INFINITE);
        motion.setInterpolator(new LinearInterpolator());
        motion.addUpdateListener(animator -> {
            phase = (Float) animator.getAnimatedValue();
            invalidate();
        });
        motion.start();
    }

    void stop() {
        if (motion != null) {
            motion.cancel();
            motion = null;
        }
    }

    @Override protected void onDetachedFromWindow() {
        stop();
        super.onDetachedFromWindow();
    }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float width = getWidth(), height = getHeight();
        if (width <= 0 || height <= 0) return;
        canvas.save();
        canvas.scale(width / 1080f, height / 1920f);

        // Two subdued travelling light ribbons.
        float drift = (float)Math.sin(phase * Math.PI * 2.0) * 28f;
        ribbon(canvas, -160, 425 + drift, 360, 20, 1180, -85, 0xE85AFB69, 5f, 38f);
        ribbon(canvas, -180, 1260, 460, 1580 + drift, 1200, 1050, 0xCC37F46B, 4f, 35f);
        ribbon(canvas, -80, 1640, 360, 1450 - drift, 1180, 1290, 0xAA37DB64, 3f, 30f);

        // Quiet floating football-field lights, deterministic between launches.
        for (int i = 0; i < 65; i++) {
            float x = ((i * 419 + 71) % 1053) + 10;
            float y = ((i * 283 + 89) % 1390) + 75;
            float shimmer = (float)(0.65 + 0.35 * Math.sin(phase * 6.283 + i * 0.73));
            paint.setColor(Color.argb(Math.round((36 + i % 7 * 10) * shimmer), 112, 255, 144));
            paint.setStyle(Paint.Style.FILL);
            canvas.drawCircle(x, y + (float)Math.sin(phase * 6.283 + i) * 6f, i % 9 == 0 ? 2.7f : 1.4f, paint);
        }

        canvas.restore();
    }

    private void ribbon(Canvas canvas, float x0, float y0, float cx, float cy,
                        float x1, float y1, int color, float width, float halo) {
        Path path = new Path();
        path.moveTo(x0, y0);
        path.quadTo(cx, cy, x1, y1);
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeCap(Paint.Cap.ROUND);
        stroke.setColor(color);
        stroke.setStrokeWidth(width);
        stroke.setShadowLayer(halo, 0f, 0f, color);
        canvas.drawPath(path, stroke);
        stroke.clearShadowLayer();
    }
}
