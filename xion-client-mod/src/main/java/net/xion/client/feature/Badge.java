package net.xion.client.feature;

import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.xion.client.XionConfig;
import net.xion.client.compat.Compat;

import java.util.UUID;

/**
 * The Xion "X" badge. assets/minecraft/font/default.json maps U+E7A0 to the free badge and
 * U+E7A1..U+E7A8 to the eight frames of the animated gold Xion+ badge, so it renders anywhere text does.
 */
public final class Badge {
	public static final String GLYPH = "";
	private static final char PRO_FIRST = '';
	private static final char PRO_LAST = '';

	/** Current badge glyph. Xion+ cycles a light sweep and a sparkle flare. */
	public static String glyph() {
		return glyph(Premium.active());
	}

	public static String glyph(boolean pro) {
		if (!pro) return GLYPH;
		long t = System.currentTimeMillis() % 3200L;
		int frame;
		if (t < 600L) frame = 1 + (int) (t / 100L);       // sweep, frames 1..6
		else if (t >= 1700L && t < 1900L) frame = 7;      // sparkle flare
		else frame = 0;
		return String.valueOf((char) (PRO_FIRST + frame));
	}

	private Badge() {}

	public static boolean isSelf(UUID id) {
		Minecraft mc = Minecraft.getInstance();
		return XionConfig.data.badge && id != null && mc.player != null && id.equals(mc.player.getUUID());
	}

	/** Your own badge, or another Xion Client player's (seen through the presence service). */
	public static boolean shows(UUID id) {
		return isSelf(id) || (XionConfig.data.badge && Presence.has(id));
	}

	private static boolean hasBadge(String s) {
		if (s.isEmpty()) return false;
		char c = s.charAt(0);
		return c == GLYPH.charAt(0) || (c >= PRO_FIRST && c <= PRO_LAST);
	}

	public static Component prefix(Component name) {
		if (name == null || hasBadge(name.getString())) return name;
		return Compat.lit(glyph() + " ").append(name);
	}

	/** Prefixes a player's name with their badge: gold for Xion+, white for free. */
	public static Component prefix(Component name, UUID id) {
		if (name == null || hasBadge(name.getString())) return name;
		boolean pro = isSelf(id) ? Premium.active() : Presence.pro(id);
		return Compat.lit(glyph(pro) + " ").append(name);
	}
}
