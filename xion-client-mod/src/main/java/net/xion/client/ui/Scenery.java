package net.xion.client.ui;

import net.minecraft.client.Minecraft;
import net.xion.client.compat.Colors;
import net.xion.client.compat.Gfx;
import net.xion.client.compat.Ids;

import java.util.Random;

/**
 * The Xion backdrop, shared with the launcher: a moonlit mountain range in layers that drift slowly,
 * follow the mouse with gentle parallax, with fog rolling between the ridges, twinkling stars,
 * the odd shooting star and light snow. Textures are linear-filtered (see the .mcmeta files).
 */
public final class Scenery {
	private static final int TW = 1280, TH = 720;
	private static final Object SKY = Ids.of("xionclient", "textures/gui/bg/sky.png");
	private static final Object FAR = Ids.of("xionclient", "textures/gui/bg/far.png");
	private static final Object MID = Ids.of("xionclient", "textures/gui/bg/mid.png");
	private static final Object NEAR = Ids.of("xionclient", "textures/gui/bg/near.png");
	private static final Object FRONT = Ids.of("xionclient", "textures/gui/bg/front.png");
	private static final Object FOG = Ids.of("xionclient", "textures/gui/bg/fog.png");

	private static final Particles SNOW = new Particles(70);
	private static final float[][] STARS = new float[48][];
	private static float px, py;
	private static long last;
	private static double meteorAt = 5, meteorX, meteorY;

	static {
		Random r = new Random(7);
		for (int i = 0; i < STARS.length; i++) STARS[i] = new float[]{r.nextFloat(), r.nextFloat() * 0.42f, r.nextFloat() * 6.28f, 0.5f + r.nextFloat() * 1.4f};
	}

	private Scenery() {}

	private static Object theme(String layer, Object fallback) {
		return net.xion.client.compat.ThemeTextures.layer(layer, fallback);
	}

	public static void draw(Gfx g, float alpha) {
		int w = g.width(), h = g.height();
		Minecraft mc = Minecraft.getInstance();
		double mx = mc.mouseHandler.xpos() / Math.max(1, mc.getWindow().getScreenWidth()) - 0.5;
		double my = mc.mouseHandler.ypos() / Math.max(1, mc.getWindow().getScreenHeight()) - 0.5;
		long now = System.nanoTime();
		float dt = last == 0 ? 0 : Math.min(0.1f, (now - last) / 1e9f);
		last = now;
		// Critically damped follow, so the parallax glides instead of snapping to the cursor.
		float k = 1f - (float) Math.exp(-dt * 2.2f);
		px += (float) (mx - px) * k;
		py += (float) (my - py) * k;
		double t = now / 1e9;

		g.fill(0, 0, w, h, Colors.alpha(0xFF06080C, alpha));
		layer(g, theme("sky", SKY), w, h, 6, 90, 0.0, alpha);
		stars(g, w, h, t, alpha);
		layer(g, theme("far", FAR), w, h, 12, 70, 1.3, alpha);
		fog(g, w, h, t, 160, -0.09f, 12, 0.75f * alpha);
		layer(g, theme("mid", MID), w, h, 20, 56, 2.1, alpha);
		layer(g, theme("near", NEAR), w, h, 30, 46, 3.4, alpha);
		fog(g, w, h, t, 100, 0.06f, 30, 0.5f * alpha);
		layer(g, theme("front", FRONT), w, h, 44, 38, 4.2, alpha);

		g.push();
		g.scale(0.5f);
		SNOW.draw(g, w * 2, h * 2, alpha * 0.7f);
		g.pop();

		g.vGradient(0, 0, w, h / 4, Colors.alpha(0x8C05060A, alpha), 0x0005060A);
		g.vGradient(0, h * 3 / 5, w, h - h * 3 / 5, 0x0005060A, Colors.alpha(0xB305060A, alpha));
	}

	private static float base(int w, int h) {
		return Math.max(w, h * 16f / 9f);
	}

	/** One ridge layer: slow breathing drift plus mouse parallax ({@code depth} is in launcher pixels). */
	private static void layer(Gfx g, Object tex, int w, int h, float depth, double period, double seed, float alpha) {
		float base = base(w, h);
		double ph = Math.PI * 2 * (System.nanoTime() / 1e9) / period + seed;
		float s = 1.03f + 0.015f * (float) Math.sin(ph);
		float dw = base * s, dh = dw * 9f / 16f;
		float unit = w / 1400f;
		float x = (w - dw) / 2f + 0.006f * base * (float) Math.sin(ph * 0.7) - px * depth * unit;
		float y = h - dh + dh * 0.012f - py * depth * 0.5f * unit;
		g.push();
		g.translate(x, y);
		g.blit(tex, 0, 0, Math.round(dw), Math.round(dh), 0, 0, TW, TH, TW, TH, Colors.alpha(0xFFFFFFFF, alpha));
		g.pop();
	}

	/** Horizontally tiling fog band scrolling left, drawn as two copies of the texture. */
	private static void fog(Gfx g, int w, int h, double t, double period, float yShift, float depth, float alpha) {
		float base = base(w, h) * 1.05f;
		float dw = base, dh = dw * 9f / 16f;
		float off = (float) ((t / period) % 1.0) * dw;
		float x = (w - dw) / 2f - off - px * depth * (w / 1400f);
		float y = h - dh + yShift * dh;
		int iw = Math.round(dw), ih = Math.round(dh);
		for (int i = 0; i < 2; i++) {
			g.push();
			g.translate(x + i * dw, y);
			g.blit(theme("fog", FOG), 0, 0, iw, ih, 0, 0, TW, TH, TW, TH, Colors.alpha(0xFFFFFFFF, alpha));
			g.pop();
		}
	}

	private static void stars(Gfx g, int w, int h, double t, float alpha) {
		g.push();
		g.scale(0.5f);
		int W = w * 2, H = h * 2;
		for (float[] s : STARS) {
			float a = (float) Math.pow(Math.abs(Math.sin(s[2] + t * s[3])), 3) * alpha;
			if (a < 0.03f) continue;
			int x = (int) (s[0] * W - px * 12 * (w / 1400f)), y = (int) (s[1] * H);
			g.fill(x, y, x + 1, y + 1, Colors.alpha(0xFFE1E9FF, a));
		}
		// An occasional shooting star across the upper sky.
		double life = t - meteorAt;
		if (life > 0.9) {
			meteorAt = t + 7 + Math.random() * 10;
			meteorX = 0.25 + Math.random() * 0.6;
			meteorY = 0.05 + Math.random() * 0.15;
		} else if (life >= 0) {
			float fade = (float) Math.sin(Math.min(1, life / 0.9) * Math.PI) * alpha;
			double hx = meteorX * W - life * W * 0.22, hy = meteorY * H + life * H * 0.14;
			for (int i = 0; i < 26; i++) {
				int x = (int) (hx + i * 2.4), y = (int) (hy - i * 1.5);
				g.fill(x, y, x + 1, y + 1, Colors.alpha(0xFFEBF0FF, fade * (1 - i / 26f)));
			}
		}
		g.pop();
	}
}
