package net.xion.client.ui;

import net.xion.client.compat.Colors;
import net.xion.client.compat.Gfx;

/** Xion's own button: drawn and hit-tested by BaseScreen, independent of vanilla widgets. */
public class XButton {
	public enum Style { PRIMARY, GLASS, DANGER, TAB, SLAB, ACCENT, TEXT, ICON }

	public enum Icon { NONE, PERSON, PEOPLE, SHIRT, STAR, GRID, GEAR, SLIDERS, POWER }

	public int x, y, w, h;
	public String label;
	public final Style style;
	public final Runnable action;
	public Icon icon = Icon.NONE;
	public String tooltip;
	public boolean visible = true;
	public boolean selected;
	/** Left-aligned label (menu lists) instead of centred. */
	public boolean alignLeft;
	/** Entrance animation: seconds before it appears, and the offset it slides in from. */
	public float delay;
	public float enterX = -18, enterY;
	private float hover;

	public XButton enter(float delay, float fromX, float fromY) {
		this.delay = delay;
		this.enterX = fromX;
		this.enterY = fromY;
		return this;
	}

	public XButton(int x, int y, int w, int h, String label, Style style, Runnable action) {
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
		this.label = label;
		this.style = style;
		this.action = action;
	}

	public XButton icon(Icon i) {
		this.icon = i;
		return this;
	}

	public XButton left() {
		this.alignLeft = true;
		return this;
	}

	public XButton tooltip(String t) {
		this.tooltip = t;
		return this;
	}

	public boolean contains(double mx, double my) {
		return mx >= x && mx < x + w && my >= y && my < y + h;
	}

	public boolean hovered() {
		return hover > 0.5f;
	}

	public void draw(Gfx g, int mx, int my, float a) {
		if (!visible) return;
		hover += ((contains(mx, my) ? 1f : 0f) - hover) * 0.25f;
		int textColor;
		switch (style) {
			case PRIMARY, ACCENT -> {
				// Light pill with dark text; a faint halo grows on hover.
				if (hover > 0.02f) g.pillOutline(x - 1, y - 1, w + 2, h + 2, Colors.alpha(0x40FFFFFF, a * hover));
				g.pill(x, y, w, h, Colors.alpha(Colors.lerp(Colors.PILL, 0xFFFFFFFF, hover), a));
				textColor = Colors.ON_PILL;
			}
			case TEXT -> textColor = Colors.lerp(Colors.MUTED, Colors.TEXT, hover);
			case TAB -> {
				if (selected) {
					g.pill(x, y, w, h, Colors.alpha(Colors.PILL, a));
					textColor = Colors.ON_PILL;
				} else {
					if (hover > 0.02f) g.pill(x, y, w, h, Colors.alpha(0x26FFFFFF, a * hover));
					textColor = Colors.lerp(Colors.MUTED, Colors.TEXT, hover);
				}
			}
			case DANGER -> {
				g.pill(x, y, w, h, Colors.alpha(Colors.lerp(Colors.GLASS, 0xC0461A24, hover), a));
				g.pillOutline(x, y, w, h, Colors.alpha(Colors.lerp(0x1FFFFFFF, 0x55FF9AA8, hover), a));
				textColor = Colors.lerp(0xFFFF9AA8, 0xFFFFFFFF, hover);
			}
			default -> {
				// Dark glass pill (SLAB, GLASS, ICON) whose edge brightens on hover.
				g.pill(x, y, w, h, Colors.alpha(Colors.lerp(Colors.GLASS, Colors.GLASS_HOVER, hover), a));
				g.pillOutline(x, y, w, h, Colors.alpha(Colors.lerp(0x1FFFFFFF, 0x55FFFFFF, hover), a));
				textColor = Colors.lerp(0xFFD5DAE3, 0xFFFFFFFF, hover);
			}
		}
		int tc = Colors.alpha(textColor, a);
		if (style == Style.ICON) {
			drawIcon(g, icon, x + (w - 9) / 2, y + (h - 9) / 2, tc);
			return;
		}
		int tw = g.font.width(label);
		int iconW = icon == Icon.NONE ? 0 : 14;
		// Content eases a couple of pixels to the right while hovered.
		int nudge = alignLeft ? Math.round(2 * hover) : 0;
		int tx = alignLeft ? x + 9 + nudge : x + (w - tw - iconW) / 2;
		if (icon != Icon.NONE) drawIcon(g, icon, tx, y + (h - 9) / 2, tc);
		g.text(label, tx + iconW, y + (h - 8) / 2, tc, false);
	}

	/** 9x9 pixel icons drawn with fills, so they look the same on every Minecraft version. */
	public static void drawIcon(Gfx g, Icon icon, int x, int y, int c) {
		switch (icon) {
			case PERSON -> {
				g.fill(x + 3, y, x + 6, y + 3, c);
				g.fill(x + 1, y + 4, x + 8, y + 9, c);
			}
			case PEOPLE -> {
				g.fill(x + 1, y + 1, x + 4, y + 4, c);
				g.fill(x + 5, y, x + 8, y + 3, c);
				g.fill(x, y + 5, x + 5, y + 9, c);
				g.fill(x + 5, y + 4, x + 9, y + 8, c);
			}
			case SHIRT -> {
				g.fill(x, y + 1, x + 9, y + 4, c);
				g.fill(x + 2, y + 4, x + 7, y + 9, c);
				g.fill(x + 3, y + 1, x + 6, y + 2, 0x00000000);
			}
			case STAR -> {
				g.fill(x + 4, y, x + 5, y + 9, c);
				g.fill(x, y + 4, x + 9, y + 5, c);
				g.fill(x + 2, y + 2, x + 7, y + 7, c);
			}
			case GRID -> {
				g.fill(x, y, x + 4, y + 4, c);
				g.fill(x + 5, y, x + 9, y + 4, c);
				g.fill(x, y + 5, x + 4, y + 9, c);
				g.fill(x + 5, y + 5, x + 9, y + 9, c);
			}
			case GEAR -> {
				g.fill(x + 3, y, x + 6, y + 9, c);
				g.fill(x, y + 3, x + 9, y + 6, c);
				g.fill(x + 1, y + 1, x + 8, y + 8, c);
				g.fill(x + 3, y + 3, x + 6, y + 6, 0xFF0C0C10);
			}
			case SLIDERS -> {
				g.fill(x, y + 1, x + 9, y + 2, c);
				g.fill(x, y + 4, x + 9, y + 5, c);
				g.fill(x, y + 7, x + 9, y + 8, c);
				g.fill(x + 2, y, x + 4, y + 3, c);
				g.fill(x + 6, y + 3, x + 8, y + 6, c);
				g.fill(x + 3, y + 6, x + 5, y + 9, c);
			}
			case POWER -> {
				g.fill(x + 4, y, x + 5, y + 4, c);
				g.fill(x + 1, y + 2, x + 2, y + 8, c);
				g.fill(x + 7, y + 2, x + 8, y + 8, c);
				g.fill(x + 2, y + 8, x + 7, y + 9, c);
			}
			default -> { }
		}
	}
}
