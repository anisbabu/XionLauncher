package net.xion.client.ui;

import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.multiplayer.ServerData;
import net.xion.client.XionClient;
import net.xion.client.compat.BaseScreen;
import net.xion.client.compat.Colors;
import net.xion.client.compat.Compat;
import net.xion.client.compat.Gfx;
import net.xion.client.compat.Ids;
import net.xion.client.hud.HudManager;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

/**
 * The Xion ESC menu: a rounded card in the middle of the screen that springs in over the dimmed
 * world, with the main action on top, a two-column grid below and live session chips underneath.
 */
public class XionPauseScreen extends BaseScreen {
	private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("HH:mm");
	private Screen vanilla;
	private int px, py, pw, ph;

	public XionPauseScreen() {
		super("Game Paused");
	}

	@Override
	protected void layout() {
		vanilla = Compat.vanillaPause();
		boolean adv = Compat.hasButton(vanilla, "gui.advancements");
		boolean stats = Compat.hasButton(vanilla, "gui.stats");
		boolean lan = Compat.hasButton(vanilla, "menu.shareToLan");
		int grid = 2 + (adv ? 1 : 0) + (stats ? 1 : 0) + (lan ? 1 : 0) + 1; // + Edit HUD
		int rows = (grid + 1) / 2;

		int bh = 20, gap = 5;
		pw = Math.min(width - 20, 236);
		ph = 50 + bh + 8 + rows * (bh + gap) + 6 + bh + 14;
		px = (width - pw) / 2;
		py = Math.max(8, (height - ph) / 2 - 10);

		int x = px + 14, w = pw - 28, half = (w - gap) / 2;
		int y = py + 50;
		float d = 0.12f;
		add(new XButton(x, y, w, bh, "Back to game", XButton.Style.PRIMARY, this::onClose).icon(XButton.Icon.PERSON).enter(d, 0, 10));
		y += bh + 8;

		int[] slot = {0};
		int baseY = y;
		java.util.function.BiConsumer<String[], Runnable> cell = (meta, run) -> {
			int i = slot[0]++;
			int cx = x + (i % 2) * (half + gap), cy = baseY + (i / 2) * (bh + gap);
			add(new XButton(cx, cy, half, bh, meta[0], XButton.Style.SLAB, run).icon(XButton.Icon.valueOf(meta[1])).enter(0.16f + i * 0.04f, 0, 10));
		};
		cell.accept(new String[]{"Options", "GEAR"}, () -> Compat.press(vanilla, "menu.options"));
		cell.accept(new String[]{"Xion Menu", "STAR"}, () -> Compat.setScreen(new XionMenuScreen(this, XionMenuScreen.Tab.HUD)));
		if (adv) cell.accept(new String[]{"Advancements", "STAR"}, () -> Compat.press(vanilla, "gui.advancements"));
		if (stats) cell.accept(new String[]{"Statistics", "GRID"}, () -> Compat.press(vanilla, "gui.stats"));
		if (lan) cell.accept(new String[]{"Open to LAN", "PEOPLE"}, () -> Compat.press(vanilla, "menu.shareToLan"));
		cell.accept(new String[]{"Edit HUD", "SLIDERS"}, () -> Compat.setScreen(new HudEditorScreen(this)));
		y = baseY + rows * (bh + gap) + 6;

		boolean local = minecraft.hasSingleplayerServer();
		add(new XButton(x, y, w, bh, local ? "Save & quit to title" : "Disconnect", XButton.Style.DANGER,
			() -> Compat.press(vanilla, "menu.returnToMenu", "menu.disconnect")).icon(XButton.Icon.POWER).enter(0.4f, 0, 10));
	}

	@Override
	protected void draw(Gfx g, int mx, int my, float pt) {
		float a = intro(0.35f);
		// Dim the world with a soft vignette toward the edges.
		g.fill(0, 0, width, height, Colors.alpha(0x6606080C, a));
		g.vGradient(0, 0, width, height / 3, Colors.alpha(0x8006080C, a), 0x0006080C);
		g.vGradient(0, height * 2 / 3, width, height / 3, 0x0006080C, Colors.alpha(0x9906080C, a));

		// Card springs in: scale 0.9 -> 1 with a slight overshoot, rising a few pixels.
		float t = ease(0f, 0.45f);
		float spring = 1f + (float) Math.sin(t * Math.PI) * 0.025f;
		float s = (0.9f + 0.1f * t) * (t >= 1 ? 1f : spring);
		float cx = px + pw / 2f, cy = py + ph / 2f;
		g.push();
		g.translate(cx, cy + (1 - t) * 10);
		g.scale(s);
		g.translate(-cx, -cy);

		// shadow + glass card
		g.pill(px - 2, py + 3, pw + 4, ph + 4, Colors.alpha(0x50000000, a));
		g.pill(px, py, pw, ph, Colors.alpha(0xEE0C0F15, a));
		g.pillOutline(px, py, pw, ph, Colors.alpha(0x26FFFFFF, a));
		// accent hairline across the top
		g.hGradient(px + 16, py + 1, pw - 32, 1, Colors.alpha(Colors.ACCENT, 0.0f), Colors.alpha(Colors.ACCENT, 0.9f * a));

		float pulse = (float) ((Math.sin(System.currentTimeMillis() / 800.0) + 1) / 2);
		g.blit(Ids.LOGO, px + 14 - 1, py + 13 - 1, 22, 22, 0, 0, 256, 256, 256, 256, Colors.alpha(0x40FFFFFF, a * pulse));
		g.blit(Ids.LOGO, px + 14, py + 14, 20, 20, 0, 0, 256, 256, 256, 256, Colors.alpha(0xFFFFFFFF, a));
		g.scaledText(net.xion.client.feature.Pvp.active() ? "PvP Paused" : "Paused", px + 40, py + 14, 1.35f, Colors.alpha(0xFFFFFFFF, a), false);
		g.text(g.font.plainSubstrByWidth(sessionLine(), pw - 54), px + 40, py + 28, Colors.alpha(Colors.MUTED, a), false);

		drawButtons(g, mx, my, a);
		g.pop();

		// Live chips under the card
		float ce = ease(0.3f, 0.4f);
		if (ce > 0) {
			String[] chips = {
				HudManager.fps() + " FPS",
				net.xion.client.feature.Pvp.active() ? HudManager.pingText(minecraft) : "",
				minecraft.player != null ? String.format("%d, %d, %d", minecraft.player.getBlockX(), minecraft.player.getBlockY(), minecraft.player.getBlockZ()) : "",
				LocalTime.now().format(CLOCK) + "  ·  " + XionClient.sessionMinutes() + "m played"
			};
			int total = 0;
			for (String c : chips) if (!c.isEmpty()) total += g.font.width(c) + 16 + 6;
			int x = (width - total + 6) / 2, y = Math.min(height - 22, py + ph + 10);
			g.push();
			g.translate(0, (1 - ce) * 8);
			for (String c : chips) {
				if (c.isEmpty()) continue;
				int cw = g.font.width(c) + 16;
				g.pill(x, y, cw, 16, Colors.alpha(0xC00C0F15, ce));
				g.pillOutline(x, y, cw, 16, Colors.alpha(0x1AFFFFFF, ce));
				g.text(c, x + 8, y + 4, Colors.alpha(Colors.TEXT, ce), false);
				x += cw + 6;
			}
			g.pop();
		}

		String ver = "Xion " + XionClient.VERSION + "  ·  Minecraft " + Compat.MC_VERSION;
		g.text(ver, width - g.font.width(ver) - 10, 8, Colors.alpha(0xFF8B94A5, a), false);
	}

	private String sessionLine() {
		ServerData s = minecraft.getCurrentServer();
		if (s != null) return s.ip;
		return minecraft.hasSingleplayerServer() ? "Singleplayer world" : "Offline";
	}

	@Override
	public boolean isPauseScreen() {
		return true;
	}
}
