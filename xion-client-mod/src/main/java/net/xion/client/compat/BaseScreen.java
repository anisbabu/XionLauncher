package net.xion.client.compat;

import net.minecraft.client.gui.screens.Screen;
import net.xion.client.ui.XButton;

import java.util.ArrayList;
import java.util.List;
//#if MC >= 260000
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.input.MouseButtonEvent;
//#elif MC >= 12109
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.input.MouseButtonEvent;
//#elif MC >= 12000
import net.minecraft.client.gui.GuiGraphics;
//#else
import com.mojang.blaze3d.vertex.PoseStack;
//#endif

/**
 * Base for all Xion screens. Bridges Minecraft's version-specific render and input signatures to
 * simple {@link #draw}/{@link #click} hooks, and drives Xion's own buttons (no vanilla widgets).
 */
public abstract class BaseScreen extends Screen {
	protected final List<XButton> buttons = new ArrayList<>();
	protected final long openedAt = System.currentTimeMillis();
	private float lastPartialTick;
	private XButton pressed;

	protected BaseScreen(String title) {
		super(Compat.lit(title));
	}

	/** Seconds since the screen opened, for intro animations. */
	protected float age() {
		return (System.currentTimeMillis() - openedAt) / 1000f;
	}

	protected float intro(float duration) {
		float t = Math.min(1f, age() / duration);
		return 1f - (1f - t) * (1f - t) * (1f - t);
	}

	@Override
	protected void init() {
		buttons.clear();
		layout();
	}

	protected abstract void layout();

	protected abstract void draw(Gfx g, int mouseX, int mouseY, float partialTick);

	protected boolean click(double x, double y, int button) {
		return false;
	}

	protected void drag(double x, double y, int button) {}

	protected void release(double x, double y, int button) {}

	protected void scroll(double x, double y, double amount) {}

	//#if MC >= 12002
	@Override
	public boolean mouseScrolled(double x, double y, double h, double v) {
		scroll(x, y, v);
		return true;
	}
	//#else
	@Override
	public boolean mouseScrolled(double x, double y, double v) {
		scroll(x, y, v);
		return true;
	}
	//#endif

	protected XButton add(XButton b) {
		buttons.add(b);
		return b;
	}

	protected void drawButtons(Gfx g, int mx, int my, float alpha) {
		for (XButton b : buttons) {
			// Staggered entrance: each button slides in from its own direction after its delay.
			float t = Math.max(0f, Math.min(1f, (age() - b.delay) / 0.45f));
			float e = 1f - (1f - t) * (1f - t) * (1f - t);
			if (e <= 0f) continue;
			g.push();
			g.translate(b.enterX * (1f - e), b.enterY * (1f - e));
			b.draw(g, mx, my, alpha * e);
			g.pop();
		}
	}

	/** Eased 0..1 progress of an animation that starts {@code delay}s after the screen opened. */
	protected float ease(float delay, float duration) {
		float t = Math.max(0f, Math.min(1f, (age() - delay) / duration));
		return 1f - (1f - t) * (1f - t) * (1f - t);
	}

	/** Menu background: the Xion mountain scenery (a soft dark wash over the world when in game). */
	protected void panorama(Gfx g) {
		if (minecraft.level != null) {
			g.fill(0, 0, width, height, 0xA006080C);
			return;
		}
		net.xion.client.ui.Scenery.draw(g, 1f);
	}

	private void frame(Gfx g, int mx, int my, float pt) {
		lastPartialTick = pt;
		draw(g, mx, my, pt);
	}

	private boolean handleClick(double x, double y, int button) {
		if (button == 0) {
			for (XButton b : buttons) {
				if (b.visible && b.contains(x, y)) {
					pressed = b;
					return true;
				}
			}
		}
		return click(x, y, button);
	}

	/**
	 * Buttons fire on release, like vanilla's. Firing on press would hand the release to the screen
	 * just opened, where newer versions treat it as a click on whatever sits under the cursor.
	 */
	private boolean handleRelease(double x, double y, int button) {
		XButton b = pressed;
		pressed = null;
		release(x, y, button);
		if (button != 0 || b == null) return false;
		if (b.visible && b.contains(x, y)) {
			Compat.click();
			b.action.run();
		}
		return true;
	}

	// ---- version bridges ----

	//#if MC >= 260000
	@Override
	public void extractBackground(GuiGraphicsExtractor gg, int mx, int my, float pt) {}

	@Override
	public void extractRenderState(GuiGraphicsExtractor gg, int mx, int my, float pt) {
		frame(new Gfx(gg), mx, my, pt);
	}
	//#elif MC >= 12000
	//#if MC >= 12002
	@Override
	public void renderBackground(GuiGraphics gg, int mx, int my, float pt) {}
	//#endif

	@Override
	public void render(GuiGraphics gg, int mx, int my, float pt) {
		frame(new Gfx(gg), mx, my, pt);
	}
	//#else
	@Override
	public void render(PoseStack pose, int mx, int my, float pt) {
		frame(new Gfx(pose), mx, my, pt);
	}
	//#endif

	//#if MC >= 12109
	@Override
	public boolean mouseClicked(MouseButtonEvent e, boolean doubleClick) {
		return handleClick(e.x(), e.y(), Compat.button(e.button())) || super.mouseClicked(e, doubleClick);
	}

	@Override
	public boolean mouseDragged(MouseButtonEvent e, double dx, double dy) {
		drag(e.x(), e.y(), Compat.button(e.button()));
		return true;
	}

	@Override
	public boolean mouseReleased(MouseButtonEvent e) {
		return handleRelease(e.x(), e.y(), Compat.button(e.button())) || super.mouseReleased(e);
	}
	//#else
	@Override
	public boolean mouseClicked(double x, double y, int button) {
		return handleClick(x, y, button) || super.mouseClicked(x, y, button);
	}

	@Override
	public boolean mouseDragged(double x, double y, int button, double dx, double dy) {
		drag(x, y, button);
		return true;
	}

	@Override
	public boolean mouseReleased(double x, double y, int button) {
		return handleRelease(x, y, button) || super.mouseReleased(x, y, button);
	}
	//#endif

	@Override
	public boolean isPauseScreen() {
		return false;
	}
}
