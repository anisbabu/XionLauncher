package net.xion.client.compat;

import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.resources.sounds.SimpleSoundInstance;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.sounds.SoundEvents;
//#if MC < 11900
import net.minecraft.network.chat.TextComponent;
//#endif

/** Small version shims that don't belong to drawing. */
public final class Compat {
	private Compat() {}

	public static final String MC_VERSION = FabricLoader.getInstance().getModContainer("minecraft")
		.map(m -> m.getMetadata().getVersion().getFriendlyString()).orElse("?");

	public static MutableComponent lit(String s) {
		//#if MC >= 11900
		return Component.literal(s);
		//#else
		return new TextComponent(s);
		//#endif
	}

	public static Screen screen() {
		Minecraft mc = Minecraft.getInstance();
		//#if MC >= 260200
		return mc.gui.screen();
		//#else
		return mc.screen;
		//#endif
	}

	public static void setScreen(Screen s) {
		Minecraft mc = Minecraft.getInstance();
		//#if MC >= 260200
		mc.gui.setScreen(s);
		//#else
		mc.setScreen(s);
		//#endif
	}

	/**
	 * Mouse button in the classic numbering (0 left, 1 right, 2 middle). 26.3 moved input to SDL, where the
	 * left button is 1 and the right one 3, so every click check goes through here.
	 */
	public static int button(int raw) {
		if (raw == com.mojang.blaze3d.platform.InputConstants.MOUSE_BUTTON_LEFT) return 0;
		if (raw == com.mojang.blaze3d.platform.InputConstants.MOUSE_BUTTON_RIGHT) return 1;
		if (raw == com.mojang.blaze3d.platform.InputConstants.MOUSE_BUTTON_MIDDLE) return 2;
		return raw;
	}

	public static void click() {
		Minecraft.getInstance().getSoundManager().play(SimpleSoundInstance.forUI(SoundEvents.UI_BUTTON_CLICK, 1.0F));
	}

	public static boolean hudHidden() {
		Minecraft mc = Minecraft.getInstance();
		//#if MC >= 260200
		return mc.gui.hud.isHidden();
		//#else
		return mc.options.hideGui;
		//#endif
	}

	/** Joins a multiplayer server directly (Quick Join on the Xion main menu). */
	public static void connect(Screen parent, String name, String host) {
		Minecraft mc = Minecraft.getInstance();
		net.minecraft.client.multiplayer.resolver.ServerAddress address = net.minecraft.client.multiplayer.resolver.ServerAddress.parseString(host);
		//#if MC >= 12002
		net.minecraft.client.multiplayer.ServerData data = new net.minecraft.client.multiplayer.ServerData(name, host, net.minecraft.client.multiplayer.ServerData.Type.OTHER);
		//#else
		net.minecraft.client.multiplayer.ServerData data = new net.minecraft.client.multiplayer.ServerData(name, host, false);
		//#endif
		//#if MC >= 12005
		net.minecraft.client.gui.screens.ConnectScreen.startConnecting(parent, mc, address, data, false, null);
		//#elif MC >= 12000
		net.minecraft.client.gui.screens.ConnectScreen.startConnecting(parent, mc, address, data, false);
		//#else
		net.minecraft.client.gui.screens.ConnectScreen.startConnecting(parent, mc, address, data);
		//#endif
	}

	/**
	 * A hidden vanilla pause screen whose buttons the Xion pause menu presses. This reuses vanilla's
	 * own (version-specific) logic for Options, Advancements, Statistics, Open to LAN and Disconnect.
	 */
	public static net.minecraft.client.gui.screens.Screen vanillaPause() {
		Minecraft mc = Minecraft.getInstance();
		net.minecraft.client.gui.screens.PauseScreen ps = new net.minecraft.client.gui.screens.PauseScreen(true);
		int w = mc.getWindow().getGuiScaledWidth(), h = mc.getWindow().getGuiScaledHeight();
		//#if MC >= 12111
		ps.init(w, h);
		//#else
		ps.init(mc, w, h);
		//#endif
		return ps;
	}

	private static net.minecraft.client.gui.components.AbstractButton findButton(net.minecraft.client.gui.screens.Screen screen, String... keys) {
		java.util.Set<String> labels = new java.util.HashSet<>();
		for (String k : keys) labels.add(net.minecraft.client.resources.language.I18n.get(k));
		for (var child : screen.children()) {
			if (child instanceof net.minecraft.client.gui.components.AbstractButton b && labels.contains(b.getMessage().getString())) return b;
		}
		return null;
	}

	/** Whether the hidden vanilla pause screen has an enabled button for any of these keys. */
	public static boolean hasButton(net.minecraft.client.gui.screens.Screen screen, String... keys) {
		var b = findButton(screen, keys);
		return b != null && b.active;
	}

	/** Presses the vanilla button with one of these translation keys. */
	public static boolean press(net.minecraft.client.gui.screens.Screen screen, String... keys) {
		var b = findButton(screen, keys);
		if (b == null || !b.active) return false;
		//#if MC >= 12109
		b.onPress(new net.minecraft.client.input.MouseButtonInfo(0, 0));
		//#else
		b.onPress();
		//#endif
		return true;
	}

	public static boolean firstPerson() {
		return Minecraft.getInstance().options.getCameraType().isFirstPerson();
	}
}
