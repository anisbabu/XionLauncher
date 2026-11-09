package net.xion.client.feature;

import net.xion.client.XionConfig;
import net.xion.client.compat.Colors;
import net.xion.client.hud.HudManager;
import net.xion.client.hud.HudModule;

import java.util.Map;

/**
 * Xion PvP mode. The launcher starts a game folder in this mode (xion-launcher.json "pvp"): the HUD gets a
 * fighting layout, every Xion screen switches to sharp corners and a red accent, and the Pro combat HUD
 * (combo, reach, target) is free.
 */
public final class Pvp {
	public static final int RED = 0xFFFF6B78;
	public static final int RED_2 = 0xFFFF4D5E;

	private record Slot(boolean on, float x, float y) {}

	// Left column: status. Centre: combat read-outs. Right: armor and potions. Bottom left: keystrokes.
	private static final Map<String, Slot> LAYOUT = Map.ofEntries(
		Map.entry("fps", new Slot(true, 0.008f, 0.015f)),
		Map.entry("ping", new Slot(true, 0.008f, 0.075f)),
		Map.entry("sprint", new Slot(true, 0.008f, 0.135f)),
		Map.entry("health", new Slot(true, 0.008f, 0.195f)),
		Map.entry("items", new Slot(true, 0.008f, 0.26f)),
		Map.entry("keystrokes", new Slot(true, 0.008f, 0.62f)),
		Map.entry("armor", new Slot(true, 1f, 0.33f)),
		Map.entry("potions", new Slot(true, 1f, 0f)),
		Map.entry("combo", new Slot(true, 0.46f, 0.56f)),
		Map.entry("reach", new Slot(true, 0.46f, 0.61f)),
		Map.entry("target", new Slot(true, 0.43f, 0.67f))
	);

	private Pvp() {}

	public static boolean active() {
		return XionConfig.launcher.pvp;
	}

	/** Applies the fighting layout once to a PvP game folder; later edits in the HUD editor are kept. */
	public static void setup() {
		if (!active()) return;
		Colors.applyTheme("#ff6b78", "#ff4d5e");
		if (XionConfig.data.pvpSetup) return;
		for (HudModule m : HudManager.MODULES) {
			XionConfig.ModuleState s = m.state();
			Slot slot = LAYOUT.get(m.id);
			s.enabled = slot != null && slot.on();
			if (slot != null) {
				s.x = slot.x();
				s.y = slot.y();
			}
		}
		XionConfig.data.autoSprint = true;
		XionConfig.data.pvpSetup = true;
		XionConfig.save();
	}
}
