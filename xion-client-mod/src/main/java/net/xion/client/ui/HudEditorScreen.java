package net.xion.client.ui;

import net.minecraft.client.gui.screens.Screen;
import net.xion.client.XionConfig;
import net.xion.client.compat.BaseScreen;
import net.xion.client.compat.Colors;
import net.xion.client.compat.Compat;
import net.xion.client.compat.Gfx;
import net.xion.client.hud.HudManager;
import net.xion.client.hud.HudModule;

/** Drag-and-drop editor for HUD module positions. */
public class HudEditorScreen extends BaseScreen {
	private final Screen parent;
	private HudModule dragging;
	private double offX, offY;

	public HudEditorScreen(Screen parent) {
		super("Edit HUD");
		this.parent = parent;
	}

	@Override
	protected void layout() {
		add(new XButton(width / 2 - 40, 8, 80, 16, "Save & Exit", XButton.Style.PRIMARY, this::onClose));
	}

	private HudModule at(double mx, double my) {
		for (int i = HudManager.MODULES.size() - 1; i >= 0; i--) {
			HudModule m = HudManager.MODULES.get(i);
			if (!m.enabled()) continue;
			int x = m.x(width, minecraft), y = m.y(height, minecraft);
			if (mx >= x && mx < x + m.scaledWidth(minecraft) && my >= y && my < y + m.scaledHeight(minecraft)) return m;
		}
		return null;
	}

	@Override
	protected void draw(Gfx g, int mx, int my, float pt) {
		if (minecraft.level == null) panorama(g);
		g.fill(0, 0, width, height, 0x70050410);
		for (int x = 0; x < width; x += 20) g.fill(x, 0, x + 1, height, 0x0EFFFFFF);
		for (int y = 0; y < height; y += 20) g.fill(0, y, width, y + 1, 0x0EFFFFFF);
		g.fill(width / 2, 0, width / 2 + 1, height, Colors.alpha(Colors.ACCENT, 0.2f));
		g.fill(0, height / 2, width, height / 2 + 1, Colors.alpha(Colors.ACCENT, 0.2f));

		HudManager.render(g, true);
		HudModule hov = dragging != null ? dragging : at(mx, my);
		for (HudModule m : HudManager.MODULES) {
			if (!m.enabled()) continue;
			int x = m.x(width, minecraft), y = m.y(height, minecraft);
			int w = m.scaledWidth(minecraft), h = m.scaledHeight(minecraft);
			g.outline(x - 2, y - 2, w + 4, h + 4, m == hov ? Colors.ACCENT_2 : Colors.alpha(Colors.ACCENT, 0.4f));
			if (m == hov) g.text(m.name + "  " + Math.round(m.scale() * 100) + "%", x, y - 11, Colors.ACCENT_2, true);
		}
		String tip = "Drag to move  ·  Scroll to resize  ·  Right-click for settings  ·  Esc to save";
		int tw = g.font.width(tip) + 16;
		g.rounded((width - tw) / 2, height - 24, tw, 16, 0xE60D0B17);
		g.text(tip, (width - tw) / 2 + 8, height - 20, Colors.TEXT, false);
		drawButtons(g, mx, my, 1f);
	}

	@Override
	protected boolean click(double x, double y, int button) {
		HudModule m = at(x, y);
		if (m != null && button == 1) {
			Compat.setScreen(new ModuleSettingsScreen(this, m));
			return true;
		}
		if (m != null && button == 0) {
			dragging = m;
			offX = x - m.x(width, minecraft);
			offY = y - m.y(height, minecraft);
			return true;
		}
		return false;
	}

	@Override
	protected void drag(double x, double y, int button) {
		if (dragging == null) return;
		int w = dragging.scaledWidth(minecraft), h = dragging.scaledHeight(minecraft);
		double nx = Math.max(0, Math.min(width - w, x - offX));
		double ny = Math.max(0, Math.min(height - h, y - offY));
		if (nx < 4) nx = 0;
		if (width - w - nx < 4) nx = width - w;
		if (Math.abs(nx + w / 2.0 - width / 2.0) < 4) nx = width / 2.0 - w / 2.0;
		if (ny < 4) ny = 0;
		if (height - h - ny < 4) ny = height - h;
		var st = dragging.state();
		st.x = (float) (nx / width);
		st.y = (float) (ny / height);
	}

	@Override
	protected void scroll(double x, double y, double amount) {
		HudModule m = at(x, y);
		if (m == null) return;
		var st = m.state();
		st.scale = Math.max(0.5f, Math.min(2f, Math.round((m.scale() + (amount > 0 ? 0.1f : -0.1f)) * 10) / 10f));
	}

	@Override
	protected void release(double x, double y, int button) {
		dragging = null;
	}

	@Override
	public void onClose() {
		XionConfig.save();
		Compat.setScreen(parent);
	}
}
