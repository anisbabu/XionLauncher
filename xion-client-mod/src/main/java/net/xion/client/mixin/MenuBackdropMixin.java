package net.xion.client.mixin;

import net.minecraft.client.gui.screens.Screen;
import net.xion.client.compat.Gfx;
import net.xion.client.ui.Scenery;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
//#if MC >= 260000
import net.minecraft.client.gui.GuiGraphicsExtractor;
//#elif MC >= 12000
import net.minecraft.client.gui.GuiGraphics;
//#else
import com.mojang.blaze3d.vertex.PoseStack;
//#endif

/**
 * Vanilla menus opened from the title screen (worlds, servers, options…) draw the Xion mountain
 * scenery instead of the panorama (1.20.5+, where vanilla then blurs it) or the dirt tile (older).
 */
@Mixin(Screen.class)
public class MenuBackdropMixin {
	//#if MC >= 260000
	@Inject(method = "extractPanorama", at = @At("HEAD"), cancellable = true)
	private void xion$backdrop(GuiGraphicsExtractor g, float partialTick, CallbackInfo ci) {
		Scenery.draw(new Gfx(g), 1f);
		ci.cancel();
	}
	//#elif MC >= 12005
	@Inject(method = "renderPanorama", at = @At("HEAD"), cancellable = true)
	private void xion$backdrop(GuiGraphics g, float partialTick, CallbackInfo ci) {
		Scenery.draw(new Gfx(g), 1f);
		ci.cancel();
	}
	//#elif MC >= 12000
	@Inject(method = "renderDirtBackground", at = @At("HEAD"), cancellable = true)
	private void xion$backdrop(GuiGraphics g, CallbackInfo ci) {
		Scenery.draw(new Gfx(g), 1f);
		g.fill(0, 0, g.guiWidth(), g.guiHeight(), 0x7006080C);
		ci.cancel();
	}
	//#elif MC >= 11904
	@Inject(method = "renderDirtBackground", at = @At("HEAD"), cancellable = true)
	private void xion$backdrop(PoseStack pose, CallbackInfo ci) {
		Gfx gfx = new Gfx(pose);
		Scenery.draw(gfx, 1f);
		gfx.fill(0, 0, gfx.width(), gfx.height(), 0x7006080C);
		ci.cancel();
	}
	//#else
	@Inject(method = "renderDirtBackground", at = @At("HEAD"), cancellable = true)
	private void xion$backdrop(int vOffset, CallbackInfo ci) {
		Gfx gfx = new Gfx(new PoseStack());
		Scenery.draw(gfx, 1f);
		gfx.fill(0, 0, gfx.width(), gfx.height(), 0x7006080C);
		ci.cancel();
	}
	//#endif
}
