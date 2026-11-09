package net.xion.client.gui;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;
import net.xion.client.XionConfig;
import net.xion.client.hud.HudManager;
import net.xion.client.hud.HudModule;

/** Right Shift menu: toggle HUD modules and open the layout editor. */
public class XionModsScreen extends Screen {
	private static final int CARD_H = 34;
	private static final int GAP = 6;

	private final Screen parent;
	private int panelX, panelY, panelW, panelH;
	private int cols = 3;
	private int cardW = 112;

	public XionModsScreen(Screen parent) {
		super(Component.literal("Xion Mods"));
		this.parent = parent;
	}

	private int rows() {
		return (HudManager.MODULES.size() + 1 + cols - 1) / cols;
	}

	@Override
	protected void init() {
		// Adapt the grid so the panel fits even at large GUI scales.
		int maxW = Math.min(width - 16, 520);
		cols = maxW >= 400 ? 4 : 3;
		cardW = Math.min(118, (maxW - 24 - (cols - 1) * GAP) / cols);
		panelW = cols * cardW + (cols - 1) * GAP + 24;
		panelH = 40 + rows() * (CARD_H + GAP) + 28;
		panelX = (width - panelW) / 2;
		panelY = (height - panelH) / 2;
		int by = panelY + panelH - 24;
		addRenderableWidget(new XionButton(panelX + 12, by, 150, 18, "Edit HUD Layout", XionButton.Style.PRIMARY,
			() -> minecraft.gui.setScreen(new HudEditorScreen(this))));
		addRenderableWidget(new XionButton(panelX + panelW - 12 - 70, by, 70, 18, "Done", XionButton.Style.GLASS, this::onClose));
	}

	private int cardX(int i) {
		return panelX + 12 + (i % cols) * (cardW + GAP);
	}

	private int cardY(int i) {
		return panelY + 40 + (i / cols) * (CARD_H + GAP);
	}

	@Override
	public void extractBackground(GuiGraphicsExtractor g, int mouseX, int mouseY, float partialTick) {
		if (minecraft.level == null) extractPanorama(g, partialTick);
		g.fill(0, 0, width, height, 0xB0050410);
	}

	@Override
	public void extractRenderState(GuiGraphicsExtractor g, int mouseX, int mouseY, float partialTick) {
		Draw.rounded(g, panelX, panelY, panelW, panelH, 0xF0110F1C);
		Draw.roundedOutline(g, panelX, panelY, panelW, panelH, 0x40B56CFF);
		Draw.hGradient(g, panelX + 1, panelY + 1, panelW - 2, 2, Draw.ACCENT, Draw.ACCENT_2);

		Draw.scaledText(g, font, "XION", panelX + 12, panelY + 12, 1.5f, Draw.TEXT, false);
		g.text(font, "CLIENT MODS", panelX + 48, panelY + 15, 0xFFC4A8FF, false);
		String hint = "Right Shift to open in game";
		g.text(font, hint, panelX + panelW - 12 - font.width(hint), panelY + 15, Draw.MUTED, false);

		int n = HudManager.MODULES.size();
		for (int i = 0; i <= n; i++) {
			int x = cardX(i), y = cardY(i);
			boolean hov = mouseX >= x && mouseX < x + cardW && mouseY >= y && mouseY < y + CARD_H;
			String name;
			String desc;
			boolean on;
			if (i < n) {
				HudModule m = HudManager.MODULES.get(i);
				name = m.name;
				desc = m.description;
				on = m.enabled();
			} else {
				name = "HUD Background";
				desc = "Dark boxes behind text";
				on = XionConfig.data.hudBackground;
			}
			Draw.rounded(g, x, y, cardW, CARD_H, hov ? 0xFF221D38 : 0xFF181526);
			Draw.roundedOutline(g, x, y, cardW, CARD_H, on ? 0x80B56CFF : 0x22FFFFFF);
			g.text(font, name, x + 6, y + 5, Draw.TEXT, false);
			g.text(font, font.plainSubstrByWidth(desc, cardW - 12), x + 6, y + 15, Draw.MUTED, false);
			// toggle pill
			int px = x + cardW - 24, py = y + CARD_H - 11;
			Draw.rounded(g, px, py, 18, 8, on ? 0xFF34E08F : 0xFF3A3850);
			g.fill(on ? px + 11 : px + 1, py + 1, on ? px + 17 : px + 7, py + 7, 0xFFFFFFFF);
			g.text(font, on ? "ON" : "OFF", x + 6, y + CARD_H - 11, on ? 0xFF34E08F : 0xFF77758C, false);
		}
		super.extractRenderState(g, mouseX, mouseY, partialTick);
	}

	@Override
	public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
		int n = HudManager.MODULES.size();
		for (int i = 0; i <= n; i++) {
			int x = cardX(i), y = cardY(i);
			if (event.x() >= x && event.x() < x + cardW && event.y() >= y && event.y() < y + CARD_H) {
				if (i < n) {
					var st = HudManager.MODULES.get(i).state();
					st.enabled = !st.enabled;
				} else {
					XionConfig.data.hudBackground = !XionConfig.data.hudBackground;
				}
				XionConfig.save();
				XionButton.playButtonClickSound(minecraft.getSoundManager());
				return true;
			}
		}
		return super.mouseClicked(event, doubleClick);
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
