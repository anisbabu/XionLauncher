package net.xion.client.compat;

/** Xion palette ("Nightfall": moonlight on charcoal) and ARGB helpers. */
public final class Colors {
	/** Theme accents: set from the launcher theme at startup (Nightfall moonlight by default). */
	public static int ACCENT = 0xFFC9D6FF;
	public static int ACCENT_2 = 0xFF8FB3FF;
	public static final int GOLD = 0xFFF5C86B;
	public static final int TEXT = 0xFFE8ECF2;
	public static final int MUTED = 0xFF8B94A5;
	public static final int PANEL = 0xEE0C0F15;
	public static final int CARD = 0xFF141821;
	public static final int CARD_HOVER = 0xFF1C2230;
	public static final int OK = 0xFF6EE7A8;
	public static final int BAD = 0xFFFF7A8A;
	/** Light pill used for primary actions, with dark text on top. */
	public static final int PILL = 0xFFE9EEF7;
	public static final int ON_PILL = 0xFF0B0D12;
	public static final int GLASS = 0x8C0D1016;
	public static final int GLASS_HOVER = 0xC01C2230;

	private Colors() {}

	/** Applies the launcher theme ("#rrggbb" colours); bad values keep the defaults. */
	public static void applyTheme(String accent, String accent2) {
		ACCENT = parse(accent, ACCENT);
		ACCENT_2 = parse(accent2, ACCENT_2);
	}

	private static int parse(String hex, int fallback) {
		try {
			return 0xFF000000 | Integer.parseInt(hex.replace("#", ""), 16);
		} catch (Exception e) {
			return fallback;
		}
	}

	/** Smooth rainbow for chroma HUD text (premium). Offset shifts the hue, e.g. per character. */
	public static int chroma(float offset) {
		float h = ((System.currentTimeMillis() % 4000L) / 4000f + offset) % 1f;
		return 0xFF000000 | (java.awt.Color.HSBtoRGB(h, 0.55f, 1f) & 0xFFFFFF);
	}

	public static int lerp(int a, int b, float t) {
		t = Math.max(0, Math.min(1, t));
		int aa = a >>> 24, ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
		int ba = b >>> 24, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
		return ((int) (aa + (ba - aa) * t) << 24) | ((int) (ar + (br - ar) * t) << 16) | ((int) (ag + (bg - ag) * t) << 8) | (int) (ab + (bb - ab) * t);
	}

	public static int alpha(int color, float a) {
		int na = (int) ((color >>> 24) * Math.max(0, Math.min(1, a)));
		return (na << 24) | (color & 0xFFFFFF);
	}

	/** Slow breathing between the two moonlight tones, used for subtle live highlights. */
	public static int pulse(float speed) {
		double t = (Math.sin(System.currentTimeMillis() / 1000.0 * speed) + 1) / 2;
		return lerp(ACCENT, ACCENT_2, (float) t);
	}
}
