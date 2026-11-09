package net.xion.client.mixin;

import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.xion.client.XionConfig;
import net.xion.client.compat.Compat;
import net.xion.client.ui.XionTitleScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
//#if MC >= 260200
import net.minecraft.client.gui.Gui;
//#else
import net.minecraft.client.Minecraft;
//#endif

/** Swaps the vanilla title screen for the Xion main menu. */
//#if MC >= 260200
@Mixin(Gui.class)
//#else
@Mixin(Minecraft.class)
//#endif
public abstract class ScreenSetMixin {
	@Inject(method = "setScreen", at = @At("HEAD"), cancellable = true)
	private void xion$replaceTitle(Screen screen, CallbackInfo ci) {
		// setScreen(null) with no world loaded means "go to the title screen" — vanilla builds it inside the method.
		boolean toTitle = screen instanceof TitleScreen || (screen == null && net.minecraft.client.Minecraft.getInstance().level == null);
		if (toTitle && XionConfig.data.customMenu) {
			ci.cancel();
			Compat.setScreen(new XionTitleScreen());
		} else if (screen instanceof net.minecraft.client.gui.screens.PauseScreen && XionConfig.data.customMenu) {
			ci.cancel();
			Compat.setScreen(new net.xion.client.ui.XionPauseScreen());
		}
	}
}
