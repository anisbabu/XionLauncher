package net.xion.client.ui;

import net.xion.client.compat.Colors;
import net.xion.client.compat.Gfx;

import java.util.Random;

/** Light snow drifting down over Xion menus. Pure fills, so it renders on every version. */
public final class Particles {
	private final int n;
	private final float[] x, y, vx, vy, size, phase;
	private final Random rnd = new Random();
	private long last = System.nanoTime();

	public Particles(int n) {
		this.n = n;
		x = new float[n]; y = new float[n]; vx = new float[n]; vy = new float[n]; size = new float[n]; phase = new float[n];
		for (int i = 0; i < n; i++) spawn(i, true);
	}

	private void spawn(int i, boolean anywhere) {
		x[i] = rnd.nextFloat();
		y[i] = anywhere ? rnd.nextFloat() : -0.03f;
		vx[i] = -0.004f - rnd.nextFloat() * 0.008f;
		vy[i] = 0.018f + rnd.nextFloat() * 0.03f;
		size[i] = rnd.nextFloat() < 0.2f ? 2 : 1;
		phase[i] = rnd.nextFloat() * 6.28f;
	}

	public void draw(Gfx g, int width, int height, float alpha) {
		long now = System.nanoTime();
		float dt = Math.min(0.05f, (now - last) / 1e9f);
		last = now;
		float t = (now / 1_000_000L) / 1000f;
		for (int i = 0; i < n; i++) {
			x[i] += vx[i] * dt + (float) Math.sin(t * 0.7f + phase[i]) * 0.00035f;
			y[i] += vy[i] * dt * size[i];
			if (y[i] > 1.03f || x[i] < -0.03f) spawn(i, false);
			float depth = size[i] > 1 ? 0.75f : 0.4f;
			int px = (int) (x[i] * width), py = (int) (y[i] * height);
			int s = (int) size[i];
			g.fill(px, py, px + s, py + s, Colors.alpha(0xFFE8EEFA, depth * alpha));
		}
	}
}
