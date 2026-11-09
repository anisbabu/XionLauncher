package net.xion.client.gui;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.narration.NarrationElementOutput;
import net.minecraft.client.gui.components.AbstractButton;
import net.minecraft.client.input.InputWithModifiers;
import net.minecraft.network.chat.Component;

/** Flat, glassy button with an animated accent hover. */
public class XionButton extends AbstractButton {
	public enum Style { PRIMARY, GLASS, DANGER }

	private final Runnable action;
	private final Style style;
	private float hover;

	public XionButton(int x, int y, int w, int h, String label, Style style, Runnable action) {
		super(x, y, w, h, Component.literal(label));
		this.action = action;
		this.style = style;
	}

	@Override
	public void onPress(InputWithModifiers input) {
		action.run();
	}

	@Override
	protected void extractContents(GuiGraphicsExtractor g, int mouseX, int mouseY, float partialTick) {
		hover += ((isHoveredOrFocused() ? 1f : 0f) - hover) * 0.25f;
		int x = getX(), y = getY(), w = getWidth(), h = getHeight();
		float a = this.alpha;

		if (style == Style.PRIMARY) {
			Draw.rounded(g, x, y, w, h, Draw.withAlpha(0xFF000000, 0.35f * a));
			int from = Draw.lerpColor(0xFF8B5CF6, 0xFFB56CFF, hover);
			int to = Draw.lerpColor(0xFF4F7BFF, 0xFF2FD8FF, hover);
			Draw.hGradient(g, x + 1, y + 1, w - 2, h - 2, Draw.withAlpha(from, a), Draw.withAlpha(to, a));
			g.fill(x + 1, y + 1, x + w - 1, y + 2, Draw.withAlpha(0x55FFFFFF, a));
		} else {
			int base = style == Style.DANGER ? 0xFF3A1420 : 0xFF14121F;
			int hov = style == Style.DANGER ? 0xFF5A1A2A : 0xFF2A2245;
			Draw.rounded(g, x, y, w, h, Draw.withAlpha(Draw.lerpColor(base, hov, hover), 0.82f * a));
			Draw.roundedOutline(g, x, y, w, h, Draw.withAlpha(Draw.lerpColor(0x33FFFFFF, Draw.ACCENT, hover), a));
			// accent underline grows on hover
			int lw = (int) ((w - 8) * hover);
			if (lw > 0) g.fill(x + (w - lw) / 2, y + h - 2, x + (w + lw) / 2, y + h - 1, Draw.withAlpha(Draw.ACCENT_2, a));
		}
		var font = Minecraft.getInstance().font;
		String label = getMessage().getString();
		int color = active ? 0xFFFFFFFF : 0xFF77758C;
		g.text(font, label, x + (w - font.width(label)) / 2, y + (h - 8) / 2, Draw.withAlpha(color, a), style == Style.PRIMARY);
	}

	@Override
	protected void updateWidgetNarration(NarrationElementOutput output) {
		defaultButtonNarrationText(output);
	}
}
