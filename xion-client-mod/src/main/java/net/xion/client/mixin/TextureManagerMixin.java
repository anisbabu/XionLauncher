package net.xion.client.mixin;

//#if MC < 12002
import net.minecraft.client.renderer.texture.AbstractTexture;
import net.minecraft.client.renderer.texture.TextureManager;
import net.minecraft.resources.ResourceLocation;
import net.xion.client.feature.WidgetSkin;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Serves the Xion-styled button atlas whenever 1.18–1.20.1 ask for widgets.png. */
@Mixin(TextureManager.class)
public abstract class TextureManagerMixin {
	@Inject(method = "getTexture(Lnet/minecraft/resources/ResourceLocation;)Lnet/minecraft/client/renderer/texture/AbstractTexture;", at = @At("HEAD"), cancellable = true)
	private void xion$widgets(ResourceLocation location, CallbackInfoReturnable<AbstractTexture> cir) {
		if (WidgetSkin.texture != null && WidgetSkin.isWidgets(location)) cir.setReturnValue(WidgetSkin.texture);
	}
}
//#else
final class TextureManagerMixin {
	private TextureManagerMixin() {}
}
//#endif
