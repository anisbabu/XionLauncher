package net.xion.client.compat;

//#if MC >= 12111
import net.minecraft.resources.Identifier;
//#else
import net.minecraft.resources.ResourceLocation;
//#endif

/** Resource identifiers (ResourceLocation, renamed Identifier in 1.21.11). Typed as Object outside compat. */
public final class Ids {
	private Ids() {}

	public static final Object LOGO = of("xionclient", "textures/gui/logo.png");
	public static final Object SKIN_OVERRIDE = of("xionclient", "dynamic/custom_skin");
	//#if MC >= 11903
	public static final Object STEVE = of("minecraft", "textures/entity/player/wide/steve.png");
	//#else
	public static final Object STEVE = of("minecraft", "textures/entity/steve.png");
	//#endif

	/** Texture of the player's current skin (custom override, real skin, or Steve). */
	public static Object skinOf(net.minecraft.client.player.AbstractClientPlayer p) {
		if (net.xion.client.feature.SkinOverride.active()) return SKIN_OVERRIDE;
		if (p == null) return STEVE;
		//#if MC >= 12109
		return p.getSkin().body().texturePath();
		//#elif MC >= 12002
		return p.getSkin().texture();
		//#else
		return p.getSkinTextureLocation();
		//#endif
	}

	//#if MC >= 12111
	public static Identifier of(String ns, String path) {
		return Identifier.fromNamespaceAndPath(ns, path);
	}

	public static Identifier cast(Object o) {
		return (Identifier) o;
	}
	//#elif MC >= 12100
	public static ResourceLocation of(String ns, String path) {
		return ResourceLocation.fromNamespaceAndPath(ns, path);
	}

	public static ResourceLocation cast(Object o) {
		return (ResourceLocation) o;
	}
	//#else
	public static ResourceLocation of(String ns, String path) {
		return new ResourceLocation(ns, path);
	}

	public static ResourceLocation cast(Object o) {
		return (ResourceLocation) o;
	}
	//#endif
}
