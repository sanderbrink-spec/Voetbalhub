package nl.voetbalhub.app;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.view.View;
import android.view.animation.LinearInterpolator;

/**
 * Original Veldio splash atmosphere. Motion stays behind the logo and loader:
 * no third-party artwork, no club crests and no external image requests.
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
        canvas.drawColor(0xFF020804);
        canvas.save();
        canvas.scale(width / 1080f, height / 1920f);

        // Deep green atmospheric light behind, never a bright rectangle.
        paint.setStyle(Paint.Style.FILL);
        paint.setShader(new RadialGradient(540, 720, 990,
                new int[]{0x502AF76B, 0x18167932, 0x00000602},
                new float[]{0f, 0.42f, 1f}, Shader.TileMode.CLAMP));
        canvas.drawRect(0, 0, 1080, 1920, paint);
        paint.setShader(null);

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

        // Pitch center circle at the foot of the image, with depth fade.
        paint.setShader(new LinearGradient(0, 1460, 0, 1920,
                new int[]{0x0024E65C, 0x35109B43, 0x06051508}, null, Shader.TileMode.CLAMP));
        canvas.drawRect(0, 1410, 1080, 1920, paint);
        paint.setShader(null);
        stroke.clearShadowLayer();
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setColor(0x665BEB7F);
        stroke.setStrokeWidth(3f);
        canvas.drawOval(new RectF(90, 1500, 990, 1700), stroke);
        canvas.drawLine(540, 1480, 540, 1920, stroke);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(GREEN);
        canvas.drawCircle(540, 1595, 4, paint);

        // Black corners and top keep Android status/navigation legible.
        paint.setShader(new LinearGradient(0, 0, 0, 350,
                new int[]{0xD9000503, 0x00000503}, null, Shader.TileMode.CLAMP));
        canvas.drawRect(0, 0, 1080, 350, paint);
        paint.setShader(null);
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
