package net.xion.client.gui;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;
import net.xion.client.XionConfig;
import net.xion.client.hud.HudManager;
import net.xion.client.hud.HudModule;

/** Drag-and-drop editor for HUD module positions. */
public class HudEditorScreen extends Screen {
	private final Screen parent;
	private HudModule dragging;
	private double offX, offY;

	public HudEditorScreen(Screen parent) {
		super(Component.literal("Edit HUD"));
		this.parent = parent;
	}

	private HudModule at(double mx, double my) {
		for (int i = HudManager.MODULES.size() - 1; i >= 0; i--) {
			HudModule m = HudManager.MODULES.get(i);
			if (!m.enabled()) continue;
			int x = m.x(width, minecraft), y = m.y(height, minecraft);
			if (mx >= x && mx < x + m.width(minecraft) && my >= y && my < y + m.height(minecraft)) return m;
		}
		return null;
	}

	@Override
	public void extractBackground(GuiGraphicsExtractor g, int mouseX, int mouseY, float partialTick) {
		if (minecraft.level == null) extractPanorama(g, partialTick);
		g.fill(0, 0, width, height, 0x60050410);
		// alignment grid
		for (int x = 0; x < width; x += 20) g.fill(x, 0, x + 1, height, 0x10FFFFFF);
		for (int y = 0; y < height; y += 20) g.fill(0, y, width, y + 1, 0x10FFFFFF);
		g.fill(width / 2, 0, width / 2 + 1, height, 0x30B56CFF);
		g.fill(0, height / 2, width, height / 2 + 1, 0x30B56CFF);
	}

	@Override
	public void extractRenderState(GuiGraphicsExtractor g, int mouseX, int mouseY, float partialTick) {
		HudManager.render(g, true);
		HudModule hov = dragging != null ? dragging : at(mouseX, mouseY);
		for (HudModule m : HudManager.MODULES) {
			if (!m.enabled()) continue;
			int x = m.x(width, minecraft), y = m.y(height, minecraft);
			int w = m.width(minecraft), h = m.height(minecraft);
			Draw.roundedOutline(g, x - 2, y - 2, w + 4, h + 4, m == hov ? Draw.ACCENT_2 : 0x80B56CFF);
			if (m == hov) g.text(font, m.name, x, y - 12, Draw.ACCENT_2, true);
		}
		String tip = "Drag elements to move them  ·  Esc to save";
		int tw = font.width(tip) + 16;
		Draw.rounded(g, (width - tw) / 2, height - 26, tw, 16, 0xE0110F1C);
		g.text(font, tip, (width - tw) / 2 + 8, height - 22, Draw.TEXT, false);
		super.extractRenderState(g, mouseX, mouseY, partialTick);
	}

	@Override
	public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
		HudModule m = at(event.x(), event.y());
		if (m != null && event.button() == 0) {
			dragging = m;
			offX = event.x() - m.x(width, minecraft);
			offY = event.y() - m.y(height, minecraft);
			return true;
		}
		return super.mouseClicked(event, doubleClick);
	}

	@Override
	public boolean mouseDragged(MouseButtonEvent event, double dx, double dy) {
		if (dragging == null) return super.mouseDragged(event, dx, dy);
		int w = dragging.width(minecraft), h = dragging.height(minecraft);
		double nx = Math.max(0, Math.min(width - w, event.x() - offX));
		double ny = Math.max(0, Math.min(height - h, event.y() - offY));
		// snap to edges and center lines
		if (nx < 4) nx = 0;
		if (width - w - nx < 4) nx = width - w;
		if (Math.abs(nx + w / 2.0 - width / 2.0) < 4) nx = width / 2.0 - w / 2.0;
		if (ny < 4) ny = 0;
		if (height - h - ny < 4) ny = height - h;
		var st = dragging.state();
		st.x = (float) (nx / width);
		st.y = (float) (ny / height);
		return true;
	}

	@Override
	public boolean mouseReleased(MouseButtonEvent event) {
		dragging = null;
		return super.mouseReleased(event);
	}

	@Override
	public void onClose() {
		XionConfig.save();
		minecraft.gui.setScreen(parent);
	}

	@Override
	public boolean isPauseScreen() {
		return false;
	}
}
