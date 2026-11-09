package net.xion.client.mixin;

import net.minecraft.client.Minecraft;
import net.minecraft.client.player.AbstractClientPlayer;
import net.xion.client.compat.Ids;
import net.xion.client.feature.Cosmetics;
import net.xion.client.feature.SkinOverride;
import net.xion.client.feature.StoreCosmetics;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
//#if MC >= 12109
import net.minecraft.core.ClientAsset;
import net.minecraft.world.entity.player.PlayerModelType;
import net.minecraft.world.entity.player.PlayerSkin;
//#elif MC >= 12002
import net.minecraft.client.resources.PlayerSkin;
//#else
import net.minecraft.resources.ResourceLocation;
//#endif

/**
 * Swaps your own player's skin for the one picked in Xion Launcher, and adds capes (also used for elytra):
 * the Xion Store cape of any player who wears one, otherwise your own Xion cape on you.
 */
@Mixin(AbstractClientPlayer.class)
public abstract class SkinMixin {
	private boolean xion$me() {
		return (Object) this == Minecraft.getInstance().player;
	}

	private boolean xion$self() {
		return xion$me() && SkinOverride.active();
	}

	private Object xion$cape() {
		Object store = StoreCosmetics.capeFor(((AbstractClientPlayer) (Object) this).getScoreboardName());
		if (store != null) return store;
		return xion$me() ? Cosmetics.capeTexture() : null;
	}

	//#if MC >= 12109
	@Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
	private void xion$skin(CallbackInfoReturnable<PlayerSkin> cir) {
		boolean skin = xion$self();
		Object cape = xion$cape();
		if (!skin && cape == null) return;
		PlayerSkin o = cir.getReturnValue();
		var id = Ids.cast(Ids.SKIN_OVERRIDE);
		var capeTex = cape == null ? o.cape() : new ClientAsset.ResourceTexture(Ids.cast(cape), Ids.cast(cape));
		cir.setReturnValue(new PlayerSkin(skin ? new ClientAsset.ResourceTexture(id, id) : o.body(), capeTex, cape == null ? o.elytra() : capeTex,
			skin ? (SkinOverride.slim() ? PlayerModelType.SLIM : PlayerModelType.WIDE) : o.model(), o.secure()));
	}
	//#elif MC >= 12002
	@Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
	private void xion$skin(CallbackInfoReturnable<PlayerSkin> cir) {
		boolean skin = xion$self();
		Object cape = xion$cape();
		if (!skin && cape == null) return;
		PlayerSkin o = cir.getReturnValue();
		cir.setReturnValue(new PlayerSkin(skin ? Ids.cast(Ids.SKIN_OVERRIDE) : o.texture(), skin ? null : o.textureUrl(),
			cape == null ? o.capeTexture() : Ids.cast(cape), cape == null ? o.elytraTexture() : Ids.cast(cape),
			skin ? (SkinOverride.slim() ? PlayerSkin.Model.SLIM : PlayerSkin.Model.WIDE) : o.model(), o.secure()));
	}
	//#else
	@Inject(method = "getSkinTextureLocation", at = @At("RETURN"), cancellable = true)
	private void xion$skin(CallbackInfoReturnable<ResourceLocation> cir) {
		if (xion$self()) cir.setReturnValue(Ids.cast(Ids.SKIN_OVERRIDE));
	}

	@Inject(method = "getModelName", at = @At("RETURN"), cancellable = true)
	private void xion$model(CallbackInfoReturnable<String> cir) {
		if (xion$self()) cir.setReturnValue(SkinOverride.slim() ? "slim" : "default");
	}

	@Inject(method = "isCapeLoaded", at = @At("RETURN"), cancellable = true)
	private void xion$capeLoaded(CallbackInfoReturnable<Boolean> cir) {
		if (xion$cape() != null) cir.setReturnValue(true);
	}

	@Inject(method = "getCloakTextureLocation", at = @At("RETURN"), cancellable = true)
	private void xion$cape(CallbackInfoReturnable<ResourceLocation> cir) {
		Object cape = xion$cape();
		if (cape != null) cir.setReturnValue(Ids.cast(cape));
	}

	@Inject(method = "isElytraLoaded", at = @At("RETURN"), cancellable = true)
	private void xion$elytraLoaded(CallbackInfoReturnable<Boolean> cir) {
		if (xion$cape() != null) cir.setReturnValue(true);
	}

	@Inject(method = "getElytraTextureLocation", at = @At("RETURN"), cancellable = true)
	private void xion$elytra(CallbackInfoReturnable<ResourceLocation> cir) {
		Object cape = xion$cape();
		if (cape != null) cir.setReturnValue(Ids.cast(cape));
	}
	//#endif
}
