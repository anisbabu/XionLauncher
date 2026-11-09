package net.xion.client.feature;

import net.minecraft.client.Minecraft;

/**
 * The Xion Pack (made by Xion Launcher in resourcepacks/Xion) turns container screens dark. Their titles are drawn
 * in dark grey by the game itself, so while the pack is selected we draw those labels light instead.
 */
public final class DarkUi {
	public static final String PACK_ID = "file/Xion";
	private static final int LIGHT = 0xDDE2EC;
	private static boolean active;
	private static long checked;

	private DarkUi() {}

	public static boolean active() {
		long now = System.currentTimeMillis();
		if (now - checked > 1000) {
			checked = now;
			try {
				active = Minecraft.getInstance().options.resourcePacks.contains(PACK_ID);
			} catch (Exception e) {
				active = false;
			}
		}
		return active;
	}

	/** The label colour to use: light when the pack is on, unchanged otherwise (keeps the alpha byte). */
	public static int label(int color) {
		return active() ? (color & 0xFF000000) | LIGHT : color;
	}
}
