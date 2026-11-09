package net.xion.client.ui;

import net.xion.client.compat.Gfx;

/** Flat front-view renderer for a 64x64 skin texture (works on every version, no entity needed). */
public final class SkinView {
	private SkinView() {}

	public static void head(Gfx g, Object tex, int x, int y, int size, int argb) {
		g.blit(tex, x, y, size, size, 8, 8, 8, 8, 64, 64, argb);
		g.blit(tex, x, y, size, size, 40, 8, 8, 8, 64, 64, argb);
	}

	/** Full body, 16 x 32 skin pixels, each drawn as {@code s} GUI pixels. */
	public static void body(Gfx g, Object tex, int x, int y, int s, int argb) {
		part(g, tex, x, y, s, 4, 0, 8, 8, 8, 8, argb);      // head
		part(g, tex, x, y, s, 4, 8, 8, 12, 20, 20, argb);   // body
		part(g, tex, x, y, s, 0, 8, 4, 12, 44, 20, argb);   // right arm
		part(g, tex, x, y, s, 12, 8, 4, 12, 36, 52, argb);  // left arm
		part(g, tex, x, y, s, 4, 20, 4, 12, 4, 20, argb);   // right leg
		part(g, tex, x, y, s, 8, 20, 4, 12, 20, 52, argb);  // left leg
		// second layer (hat, jacket, sleeves, pants)
		part(g, tex, x, y, s, 4, 0, 8, 8, 40, 8, argb);
		part(g, tex, x, y, s, 4, 8, 8, 12, 20, 36, argb);
		part(g, tex, x, y, s, 0, 8, 4, 12, 44, 36, argb);
		part(g, tex, x, y, s, 12, 8, 4, 12, 52, 52, argb);
		part(g, tex, x, y, s, 4, 20, 4, 12, 4, 36, argb);
		part(g, tex, x, y, s, 8, 20, 4, 12, 4, 52, argb);
	}

	private static void part(Gfx g, Object tex, int x, int y, int s, int dx, int dy, int w, int h, int u, int v, int argb) {
		g.blit(tex, x + dx * s, y + dy * s, w * s, h * s, u, v, w, h, 64, 64, argb);
	}
}
