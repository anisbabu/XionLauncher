package net.xion.client.mixin;

import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.xion.client.XionConfig;
import net.xion.client.gui.XionTitleScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Gui.class)
public abstract class GuiMixin {
	/** Swap the vanilla title screen for the Xion main menu. */
	@Inject(method = "setScreen", at = @At("HEAD"), cancellable = true)
	private void xion$replaceTitle(Screen screen, CallbackInfo ci) {
		if (screen instanceof TitleScreen && XionConfig.data.customMenu) {
			ci.cancel();
			((Gui) (Object) this).setScreen(new XionTitleScreen());
		}
	}
}
