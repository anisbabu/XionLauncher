package net.xion.client.mixin;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.components.AbstractSelectionList;
import net.xion.client.compat.Gfx;
import net.xion.client.ui.Scenery;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
//#if MC >= 12000 && MC < 12005
import net.minecraft.client.gui.GuiGraphics;
//#elif MC < 12000
import com.mojang.blaze3d.vertex.PoseStack;
//#endif

/**
 * Before 1.20.5 the world and server lists paint their own dirt tiles over the whole screen, hiding the Xion
 * scenery. Lists opened from the main menu draw the scenery instead (some screens, like the world list, rely
 * on the list to clear the screen, so the list keeps painting a full backdrop).
 */
@Mixin(AbstractSelectionList.class)
public abstract class ListBackdropMixin {
//#if MC < 12005
	@Unique
	private boolean xion$scenery;

	@Inject(method = "<init>", at = @At("TAIL"), require = 0)
	private void xion$noDirt(CallbackInfo ci) {
		if (Minecraft.getInstance().level != null) return;
		xion$scenery = true;
		AbstractSelectionList<?> self = (AbstractSelectionList<?>) (Object) this;
		self.setRenderBackground(false);
		//#if MC < 12002
		self.setRenderTopAndBottom(false);
		//#endif
	}

	//#if MC >= 12000
	@Inject(method = "render", at = @At("HEAD"), require = 0)
	private void xion$backdrop(GuiGraphics g, int mx, int my, float pt, CallbackInfo ci) {
		if (!xion$scenery || Minecraft.getInstance().level != null) return;
		Gfx gfx = new Gfx(g);
		Scenery.draw(gfx, 1f);
		gfx.fill(0, 0, gfx.width(), gfx.height(), 0x7006080C);
	}
	//#else
	@Inject(method = "render", at = @At("HEAD"), require = 0)
	private void xion$backdrop(PoseStack pose, int mx, int my, float pt, CallbackInfo ci) {
		if (!xion$scenery || Minecraft.getInstance().level != null) return;
		Gfx gfx = new Gfx(pose);
		Scenery.draw(gfx, 1f);
		gfx.fill(0, 0, gfx.width(), gfx.height(), 0x7006080C);
	}
	//#endif
//#endif
}
