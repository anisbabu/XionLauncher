package net.xion.client.ui;

import net.xion.client.compat.Colors;
import net.xion.client.compat.Compat;
import net.xion.client.compat.Gfx;
import net.xion.client.feature.Cosmetics;
import net.xion.client.feature.Premium;

import java.util.List;

/** "Cosmetics" tab of the Xion menu: a scrollable grid of capes. Xion+ capes show a lock for free players. */
final class CosmeticsPanel {
	private static final int HEAD = 28, FW = 25, FH = 40, PITCH_X = 31, PITCH_Y = 46;

	/** What a click did. */
	enum Click { NONE, PICKED, LOCKED }

	private static int cols(int w) {
		return Math.max(1, w / PITCH_X);
	}

	int height(int w) {
		int n = Cosmetics.capes().size() + 1;
		return HEAD + (n + cols(w) - 1) / cols(w) * PITCH_Y;
	}

	void draw(Gfx g, int x, int y, int w, int h, double scroll, int mx, int my, float a) {
		List<Cosmetics.Cape> capes = Cosmetics.capes();
		int top = y - (int) scroll;
		Cosmetics.Cape hover = null;
		boolean hoverNone = false;
		int cols = cols(w);
		String sel = Cosmetics.selectedId();
		for (int i = -1; i < capes.size(); i++) {
			int k = i + 1, cx = x + (k % cols) * PITCH_X, cy = top + HEAD + (k / cols) * PITCH_Y;
			if (cy + FH < y || cy > y + h) continue;
			boolean over = mx >= cx && mx < cx + FW + 2 && my >= cy && my < cy + FH + 2 && my >= y && my < y + h;
			g.rounded(cx - 1, cy - 1, FW + 4, FH + 4, Colors.alpha(over ? Colors.CARD_HOVER : Colors.CARD, a));
			if (i < 0) {
				hoverNone |= over;
				g.centeredText("none", cx + 1 + FW / 2f, cy + FH / 2f - 3, 1f, Colors.alpha(Colors.MUTED, a), false);
				if (sel.isEmpty()) g.outline(cx - 1, cy - 1, FW + 4, FH + 4, Colors.alpha(Colors.ACCENT, a));
				continue;
			}
			Cosmetics.Cape c = capes.get(i);
			if (over) hover = c;
			Object tex = Cosmetics.texture(c);
			if (tex != null) g.blit(tex, cx + 1, cy + 1, FW, FH, Cosmetics.FACE_U, Cosmetics.FACE_V, Cosmetics.FACE_W, Cosmetics.FACE_H, Cosmetics.TEX_W, Cosmetics.TEX_H, Colors.alpha(0xFFFFFFFF, a));
			if (!c.usable()) {
				g.fill(cx + 1, cy + 1, cx + 1 + FW, cy + 1 + FH, Colors.alpha(0x99000000, a));
				g.centeredText("XION+", cx + 1 + FW / 2f, cy + FH / 2f - 2, 0.6f, Colors.alpha(Colors.GOLD, a), false);
			} else if (c.pro()) {
				g.fill(cx + FW - 3, cy + 2, cx + FW, cy + 5, Colors.alpha(Colors.GOLD, a));
			}
			if (c.id.equals(sel)) g.outline(cx - 1, cy - 1, FW + 4, FH + 4, Colors.alpha(c.pro() ? Colors.GOLD : Colors.ACCENT, a));
		}

		// header (drawn last so the grid scrolls under it)
		g.fill(x, y, x + w, y + HEAD - 4, Colors.alpha(Colors.PANEL, a));
		Cosmetics.Cape worn = Cosmetics.find(sel);
		String line = hover != null ? hover.name + "  ·  " + hover.cat + (hover.pro() ? "  ·  Xion+" : "  ·  Free")
			: hoverNone ? "No cape" : worn != null ? "Wearing: " + worn.name : "Pick a cape";
		g.text(line, x, y + 2, Colors.alpha(hover != null && hover.pro() ? Colors.GOLD : Colors.TEXT, a), false);
		String sub = capes.isEmpty() ? "Cape set not found. Launch the game from Xion Launcher."
			: capes.size() + " capes  ·  your elytra matches  ·  only you see them" + (Premium.active() ? "" : "  ·  Xion+ unlocks all");
		g.text(g.font.plainSubstrByWidth(sub, w), x, y + 13, Colors.alpha(Colors.MUTED, a), false);
	}

	Click click(double mx, double my, int x, int y, int w, int h, double scroll) {
		if (my < y + HEAD - 4 || my >= y + h || mx < x) return Click.NONE;
		int cols = cols(w);
		int col = (int) ((mx - x) / PITCH_X), row = (int) ((my - y + scroll - HEAD) / PITCH_Y);
		if (col >= cols || row < 0 || mx - x - col * PITCH_X > FW + 2) return Click.NONE;
		int i = row * cols + col - 1;
		List<Cosmetics.Cape> capes = Cosmetics.capes();
		if (i >= capes.size()) return Click.NONE;
		Compat.click();
		if (i < 0) {
			Cosmetics.select("");
			return Click.PICKED;
		}
		Cosmetics.Cape c = capes.get(i);
		if (!c.usable()) return Click.LOCKED;
		Cosmetics.select(c.id);
		return Click.PICKED;
	}
}
