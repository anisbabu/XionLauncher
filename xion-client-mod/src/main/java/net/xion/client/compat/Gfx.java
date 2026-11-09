package net.xion.client.compat;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.world.item.ItemStack;
//#if MC >= 260000
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.renderer.RenderPipelines;
//#elif MC >= 12106
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.renderer.RenderPipelines;
//#elif MC >= 12000
import net.minecraft.client.gui.GuiGraphics;
//#if MC >= 12102
import net.minecraft.client.renderer.RenderType;
//#else
import com.mojang.blaze3d.systems.RenderSystem;
//#endif
//#else
import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.gui.GuiComponent;
import net.minecraft.client.renderer.GameRenderer;
//#endif

/**
 * Version-neutral drawing surface. All Xion UI and HUD code draws through this class so the
 * rest of the mod never touches Minecraft's (frequently changing) rendering API directly.
 */
public final class Gfx {
	//#if MC >= 260000
	public final GuiGraphicsExtractor g;
	//#elif MC >= 12000
	public final GuiGraphics g;
	//#else
	public final PoseStack pose;
	//#endif

	public final Minecraft mc = Minecraft.getInstance();
	public final Font font = mc.font;
	private final int width;
	private final int height;
	// Translation applied through push/translate, tracked for APIs that ignore the pose stack.
	private float tx, ty;
	private final java.util.ArrayDeque<float[]> saved = new java.util.ArrayDeque<>();

	//#if MC >= 260000
	public Gfx(GuiGraphicsExtractor g) {
		this.g = g;
		this.width = g.guiWidth();
		this.height = g.guiHeight();
	}
	//#elif MC >= 12000
	public Gfx(GuiGraphics g) {
		this.g = g;
		this.width = g.guiWidth();
		this.height = g.guiHeight();
	}
	//#else
	public Gfx(PoseStack pose) {
		this.pose = pose;
		this.width = mc.getWindow().getGuiScaledWidth();
		this.height = mc.getWindow().getGuiScaledHeight();
	}
	//#endif

	public int width() {
		return width;
	}

	public int height() {
		return height;
	}

	public void push() {
		saved.push(new float[]{tx, ty});
		//#if MC >= 12106
		g.pose().pushMatrix();
		//#elif MC >= 12000
		g.pose().pushPose();
		//#else
		pose.pushPose();
		//#endif
	}

	public void pop() {
		float[] s = saved.pop();
		tx = s[0];
		ty = s[1];
		//#if MC >= 12106
		g.pose().popMatrix();
		//#elif MC >= 12000
		g.pose().popPose();
		//#else
		pose.popPose();
		//#endif
	}

	public void translate(float x, float y) {
		tx += x;
		ty += y;
		//#if MC >= 12106
		g.pose().translate(x, y);
		//#elif MC >= 12000
		g.pose().translate((double) x, (double) y, 0.0);
		//#else
		pose.translate((double) x, (double) y, 0.0);
		//#endif
	}

	public void scale(float s) {
		//#if MC >= 12106
		g.pose().scale(s, s);
		//#elif MC >= 12000
		g.pose().scale(s, s, 1f);
		//#else
		pose.scale(s, s, 1f);
		//#endif
	}

	public void fill(int x1, int y1, int x2, int y2, int color) {
		if ((color >>> 24) == 0) return;
		//#if MC >= 12000
		g.fill(x1, y1, x2, y2, color);
		//#else
		GuiComponent.fill(pose, x1, y1, x2, y2, color);
		//#endif
	}

	public void text(String s, int x, int y, int color, boolean shadow) {
		if ((color >>> 24) < 8) return;
		//#if MC >= 260000
		g.text(font, s, x, y, color, shadow);
		//#elif MC >= 12000
		g.drawString(font, s, x, y, color, shadow);
		//#else
		if (shadow) font.drawShadow(pose, s, x, y, color);
		else font.draw(pose, s, x, y, color);
		//#endif
	}

	public void item(ItemStack stack, int x, int y) {
		//#if MC >= 260000
		g.item(stack, x, y);
		//#elif MC >= 12000
		g.renderItem(stack, x, y);
		//#elif MC >= 11904
		mc.getItemRenderer().renderAndDecorateItem(pose, stack, x, y);
		//#else
		mc.getItemRenderer().renderAndDecorateItem(stack, Math.round(x + tx), Math.round(y + ty));
		//#endif
	}

	/** Draws a region of a texture, tinted with an ARGB color (alpha fades it). */
	public void blit(Object texture, int x, int y, int w, int h, float u, float v, int rw, int rh, int texW, int texH, int argb) {
		var tex = Ids.cast(texture);
		//#if MC >= 12106
		g.blit(RenderPipelines.GUI_TEXTURED, tex, x, y, u, v, w, h, rw, rh, texW, texH, argb);
		//#elif MC >= 12102
		g.blit(RenderType::guiTextured, tex, x, y, u, v, w, h, rw, rh, texW, texH, argb);
		//#elif MC >= 12000
		RenderSystem.enableBlend();
		g.setColor(((argb >> 16) & 255) / 255f, ((argb >> 8) & 255) / 255f, (argb & 255) / 255f, (argb >>> 24) / 255f);
		g.blit(tex, x, y, w, h, u, v, rw, rh, texW, texH);
		g.setColor(1f, 1f, 1f, 1f);
		//#else
		RenderSystem.setShader(GameRenderer::getPositionTexShader);
		RenderSystem.setShaderTexture(0, tex);
		RenderSystem.enableBlend();
		RenderSystem.defaultBlendFunc();
		RenderSystem.setShaderColor(((argb >> 16) & 255) / 255f, ((argb >> 8) & 255) / 255f, (argb & 255) / 255f, (argb >>> 24) / 255f);
		GuiComponent.blit(pose, x, y, w, h, u, v, rw, rh, texW, texH);
		RenderSystem.setShaderColor(1f, 1f, 1f, 1f);
		//#endif
	}

	// ---- helpers built on the primitives ----

	/** Filled rectangle with trimmed corners — reads as rounded at GUI scale. */
	public void rounded(int x, int y, int w, int h, int color) {
		if (w <= 2 || h <= 2 || net.xion.client.XionConfig.launcher.pvp) {
			fill(x, y, x + w, y + h, color);
			return;
		}
		fill(x + 1, y, x + w - 1, y + h, color);
		fill(x, y + 1, x + 1, y + h - 1, color);
		fill(x + w - 1, y + 1, x + w, y + h - 1, color);
	}

	/** Filled rectangle with two-step corners — reads as a soft pill at GUI scale. */
	public void pill(int x, int y, int w, int h, int color) {
		if (w <= 4 || h <= 4 || net.xion.client.XionConfig.launcher.pvp) {
			rounded(x, y, w, h, color);
			return;
		}
		fill(x + 2, y, x + w - 2, y + h, color);
		fill(x + 1, y + 1, x + 2, y + h - 1, color);
		fill(x + w - 2, y + 1, x + w - 1, y + h - 1, color);
		fill(x, y + 2, x + 1, y + h - 2, color);
		fill(x + w - 1, y + 2, x + w, y + h - 2, color);
	}

	/** 1px outline matching {@link #pill}. */
	public void pillOutline(int x, int y, int w, int h, int color) {
		if (w <= 4 || h <= 4 || net.xion.client.XionConfig.launcher.pvp) {
			outline(x, y, w, h, color);
			return;
		}
		fill(x + 2, y, x + w - 2, y + 1, color);
		fill(x + 2, y + h - 1, x + w - 2, y + h, color);
		fill(x, y + 2, x + 1, y + h - 2, color);
		fill(x + w - 1, y + 2, x + w, y + h - 2, color);
		fill(x + 1, y + 1, x + 2, y + 2, color);
		fill(x + w - 2, y + 1, x + w - 1, y + 2, color);
		fill(x + 1, y + h - 2, x + 2, y + h - 1, color);
		fill(x + w - 2, y + h - 2, x + w - 1, y + h - 1, color);
	}

	public void outline(int x, int y, int w, int h, int color) {
		if (net.xion.client.XionConfig.launcher.pvp) {
			fill(x, y, x + w, y + 1, color);
			fill(x, y + h - 1, x + w, y + h, color);
			fill(x, y + 1, x + 1, y + h - 1, color);
			fill(x + w - 1, y + 1, x + w, y + h - 1, color);
			return;
		}
		fill(x + 1, y, x + w - 1, y + 1, color);
		fill(x + 1, y + h - 1, x + w - 1, y + h, color);
		fill(x, y + 1, x + 1, y + h - 1, color);
		fill(x + w - 1, y + 1, x + w, y + h - 1, color);
	}

	public void hGradient(int x, int y, int w, int h, int from, int to) {
		int steps = Math.max(1, Math.min(w, 40));
		for (int i = 0; i < steps; i++) {
			fill(x + w * i / steps, y, x + w * (i + 1) / steps, y + h, Colors.lerp(from, to, i / (float) Math.max(1, steps - 1)));
		}
	}

	public void vGradient(int x, int y, int w, int h, int from, int to) {
		int steps = Math.max(1, Math.min(h, 32));
		for (int i = 0; i < steps; i++) {
			fill(x, y + h * i / steps, x + w, y + h * (i + 1) / steps, Colors.lerp(from, to, i / (float) Math.max(1, steps - 1)));
		}
	}

	public void scaledText(String s, float x, float y, float scale, int color, boolean shadow) {
		push();
		translate(x, y);
		scale(scale);
		text(s, 0, 0, color, shadow);
		pop();
	}

	public void centeredText(String s, float cx, float y, float scale, int color, boolean shadow) {
		scaledText(s, cx - font.width(s) * scale / 2f, y, scale, color, shadow);
	}
}
