package net.xion.client.ui;

import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.xion.client.XionClient;
import net.xion.client.XionConfig;
import net.xion.client.compat.BaseScreen;
import net.xion.client.compat.Colors;
import net.xion.client.compat.Compat;
import net.xion.client.compat.Gfx;
import net.xion.client.compat.Ids;
//#if MC >= 12100
import net.minecraft.client.gui.screens.options.OptionsScreen;
//#else
import net.minecraft.client.gui.screens.OptionsScreen;
//#endif

/** The Xion main menu, replacing the vanilla title screen. */
public class XionTitleScreen extends BaseScreen {
	public XionTitleScreen() {
		super("Xion Client");
	}

	@Override
	protected void layout() {
		int cx = width / 2;
		int top = height / 2 - 18;
		int bw = 200;
		add(new XButton(cx - bw / 2, top, bw, 22, "Singleplayer", XButton.Style.PRIMARY, () -> Compat.setScreen(new SelectWorldScreen(this))));
		add(new XButton(cx - bw / 2, top + 26, bw, 22, "Multiplayer", XButton.Style.GLASS, () -> Compat.setScreen(new JoinMultiplayerScreen(this))));
		int sw = (bw - 8) / 3;
		int row = top + 52;
		add(new XButton(cx - bw / 2, row, sw, 20, "Options", XButton.Style.GLASS, () -> Compat.setScreen(options())));
		add(new XButton(cx - bw / 2 + sw + 4, row, sw, 20, "Mods", XButton.Style.GLASS, () -> Compat.setScreen(modsScreen())));
		add(new XButton(cx - bw / 2 + (sw + 4) * 2, row, bw - (sw + 4) * 2, 20, "Quit", XButton.Style.DANGER, minecraft::stop));
		add(new XButton(cx - bw / 2, row + 24, bw, 18, "Xion Menu  ·  HUD, Profile & Mods", XButton.Style.GLASS,
			() -> Compat.setScreen(new XionMenuScreen(this, XionMenuScreen.Tab.HUD))));
	}

	private Screen options() {
		//#if MC >= 260000 && MC < 260300
		return new OptionsScreen(this, minecraft.options, false);
		//#else
		return new OptionsScreen(this, minecraft.options);
		//#endif
	}

	/** Uses Mod Menu when installed, otherwise the Xion mod list. */
	private Screen modsScreen() {
		if (FabricLoader.getInstance().isModLoaded("modmenu")) {
			try {
				return (Screen) Class.forName("com.terraformersmc.modmenu.gui.ModsScreen").getConstructor(Screen.class).newInstance(this);
			} catch (ReflectiveOperationException | LinkageError ignored) {
			}
		}
		return new XionMenuScreen(this, XionMenuScreen.Tab.MODS);
	}

	@Override
	protected void draw(Gfx g, int mx, int my, float pt) {
		panorama(g);
		// Deep, almost-black brand tint with a slow-moving glow band.
		g.vGradient(0, 0, width, height, 0xC8050410, 0xF0040309);
		float t = (System.currentTimeMillis() % 8000L) / 8000f;
		int bandY = (int) (height * (0.15f + 0.7f * (0.5f + 0.5f * (float) Math.sin(t * Math.PI * 2))));
		g.vGradient(0, bandY - 40, width, 40, 0x00000000, 0x14B56CFF);
		g.vGradient(0, bandY, width, 40, 0x142FD8FF, 0x00000000);

		float a = intro(0.7f);
		int cx = width / 2;
		int logoY = height / 2 - 108 + (int) ((1 - a) * 12);
		g.blit(Ids.LOGO, cx - 22, logoY, 44, 44, 0, 0, 128, 128, 128, 128, Colors.alpha(0xFFFFFFFF, a));
		g.centeredText("X I O N", cx, logoY + 50, 2.2f, Colors.alpha(Colors.TEXT, a), true);
		g.centeredText("C L I E N T", cx, logoY + 72, 0.75f, Colors.alpha(Colors.pulse(1.2f), a), false);

		drawButtons(g, mx, my, a);

		// Profile chip (top right)
		String name = minecraft.getUser().getName();
		String sub = "microsoft".equals(XionConfig.launcher.account) ? "Microsoft" : "Offline";
		int cw = Math.max(g.font.width(name), g.font.width(sub)) + 34;
		int chx = width - cw - 6;
		g.rounded(chx, 6, cw, 24, Colors.alpha(0xD00D0B17, a));
		g.outline(chx, 6, cw, 24, Colors.alpha(0x30B56CFF, a));
		SkinView.head(g, Ids.skinOf(null), chx + 4, 10, 16, Colors.alpha(0xFFFFFFFF, a));
		g.text(name, chx + 24, 9, Colors.alpha(Colors.TEXT, a), false);
		g.text(sub, chx + 24, 19, Colors.alpha(Colors.MUTED, a), false);

		String left = "Xion Client " + XionClient.VERSION + "  ·  Minecraft " + Compat.MC_VERSION;
		g.text(left, 6, height - 12, 0xFF6E6B86, false);
		String right = "Not affiliated with Mojang";
		g.text(right, width - g.font.width(right) - 6, height - 12, 0xFF6E6B86, false);
	}

	@Override
	public boolean shouldCloseOnEsc() {
		return false;
	}
}
