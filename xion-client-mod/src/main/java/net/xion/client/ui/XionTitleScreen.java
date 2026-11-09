package net.xion.client.ui;

import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.xion.client.XionClient;
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

/**
 * The Xion main menu (replaces the vanilla title screen): the moonlit mountain scenery with a quiet
 * menu in the lower left, quick-join cards in the lower right and tools in the top right.
 */
public class XionTitleScreen extends BaseScreen {
	private static final String[][] SERVERS = net.xion.client.feature.Pvp.active() ? new String[][]{
		{"Hypixel", "mc.hypixel.net", "H", "FFF5A623"},
		{"Minemen Club", "minemen.club", "M", "FFD9435A"},
		{"PvP Legacy", "play.pvplegacy.net", "L", "FFE0703A"},
		{"Bedwars Practice", "bedwarspractice.club", "B", "FFB23A8E"}
	} : new String[][]{
		{"Hypixel", "mc.hypixel.net", "H", "FFF5A623"},
		{"CubeCraft", "play.cubecraft.net", "C", "FF3B8EEA"},
		{"DonutSMP", "donutsmp.net", "D", "FF2F6BFF"},
		{"Wynncraft", "play.wynncraft.com", "W", "FF5FB548"}
	};
	private static final int CARD_W = 134, CARD_H = 22;
	private static boolean widgetsSkinned;

	private final XButton[] serverButtons = new XButton[SERVERS.length];
	private int menuX, menuTop;

	public XionTitleScreen() {
		super("Xion Client");
	}

	@Override
	protected void layout() {
		if (!widgetsSkinned) {
			widgetsSkinned = true;
			net.xion.client.feature.WidgetSkin.apply();
		}
		int bw = 128, bh = 20, gap = 4;
		menuX = 22;
		// Five rows (four buttons + quit link) anchored to the bottom-left corner.
		int y = height - 22 - 14 - 4 * (bh + gap);
		menuTop = y;
		add(new XButton(menuX, y, bw, bh, "Singleplayer", XButton.Style.PRIMARY, () -> Compat.setScreen(new SelectWorldScreen(this))).icon(XButton.Icon.PERSON).left().enter(0.35f, -16, 0));
		y += bh + gap;
		add(new XButton(menuX, y, bw, bh, "Multiplayer", XButton.Style.SLAB, () -> Compat.setScreen(new JoinMultiplayerScreen(this))).icon(XButton.Icon.PEOPLE).left().enter(0.41f, -16, 0));
		y += bh + gap;
		add(new XButton(menuX, y, bw, bh, "Options", XButton.Style.SLAB, () -> Compat.setScreen(options())).icon(XButton.Icon.GEAR).left().enter(0.47f, -16, 0));
		y += bh + gap;
		add(new XButton(menuX, y, bw, bh, "Xion Menu", XButton.Style.SLAB, () -> Compat.setScreen(new XionMenuScreen(this, XionMenuScreen.Tab.HUD))).icon(XButton.Icon.STAR).left().enter(0.53f, -16, 0));
		y += bh + gap + 2;
		add(new XButton(menuX, y, 60, 14, "Quit game", XButton.Style.TEXT, minecraft::stop).icon(XButton.Icon.POWER).left().enter(0.6f, -16, 0));

		// Top-right tools
		int ix = width - 10 - 20;
		add(new XButton(ix, 8, 20, 20, "", XButton.Style.ICON, () -> Compat.setScreen(new HudEditorScreen(this))).icon(XButton.Icon.SLIDERS).tooltip("Edit HUD").enter(0.5f, 0, -10));
		ix -= 24;
		add(new XButton(ix, 8, 20, 20, "", XButton.Style.ICON, () -> Compat.setScreen(modsScreen())).icon(XButton.Icon.GRID).tooltip("Mods").enter(0.45f, 0, -10));
		ix -= 24;
		add(new XButton(ix, 8, 20, 20, "", XButton.Style.ICON, () -> Compat.setScreen(new XionMenuScreen(this, XionMenuScreen.Tab.PROFILE))).icon(XButton.Icon.SHIRT).tooltip("Profile & skin").enter(0.4f, 0, -10));

		// Quick-join cards, bottom right
		int cx = width - 14 - CARD_W;
		int cy = height - 22 - SERVERS.length * (CARD_H + 4) + 4;
		for (int i = 0; i < SERVERS.length; i++) {
			String[] s = SERVERS[i];
			serverButtons[i] = add(new XButton(cx, cy + i * (CARD_H + 4), CARD_W, CARD_H, "", XButton.Style.SLAB, () -> Compat.connect(this, s[0], s[1])).enter(0.55f + i * 0.05f, 16, 0));
		}
	}

	private Screen options() {
		return optionsScreen(this);
	}

	/** Vanilla options screen (constructor differs on 26.1–26.2). */
	public static Screen optionsScreen(Screen parent) {
		var mc = net.minecraft.client.Minecraft.getInstance();
		//#if MC >= 260000 && MC < 260300
		return new OptionsScreen(parent, mc.options, false);
		//#else
		return new OptionsScreen(parent, mc.options);
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
		Scenery.draw(g, intro(1.4f));
		// Soft shade behind the menu so it reads over bright peaks.
		g.hGradient(0, 0, width * 3 / 5, height, 0x9905060A, 0x0005060A);

		float a = intro(0.8f);
		float rise = (1 - ease(0.15f, 0.7f)) * 8;

		// Brand, top left
		g.blit(Ids.LOGO, 14, 10, 16, 16, 0, 0, 256, 256, 256, 256, Colors.alpha(0xFFFFFFFF, a));
		g.text("Xion", 36, 14, Colors.alpha(Colors.TEXT, a), false);
		g.text("by Taseen Rahman", 36 + g.font.width("Xion") + 6, 14, Colors.alpha(0xFF8B94A5, a), false);
		if (net.xion.client.feature.Pvp.active()) {
			int tx = 36 + g.font.width("Xion") + 6 + g.font.width("by Taseen Rahman") + 8;
			g.fill(tx, 12, tx + g.font.width("PVP MODE") + 8, 24, Colors.alpha(Colors.ACCENT, a));
			g.text("PVP MODE", tx + 4, 14, Colors.alpha(0xFF1A0709, a), false);
		}

		// Greeting above the menu
		String name = minecraft.getUser().getName();
		float ga = ease(0.15f, 0.7f);
		g.push();
		g.translate(0, rise);
		g.text(net.xion.client.feature.Pvp.active() ? "Ready to fight," : "Welcome back,", menuX, menuTop - 52, Colors.alpha(0xFFAEB6C4, ga), false);
		g.scaledText(name, menuX, menuTop - 40, 3f, Colors.alpha(0xFFFFFFFF, ga), false);
		g.pop();

		drawButtons(g, mx, my, a);

		// Quick-join card contents drawn over the card buttons
		XButton first = serverButtons[0];
		float ha = ease(first.delay, 0.45f);
		g.text(net.xion.client.feature.Pvp.active() ? "Arenas" : "Quick join", first.x + 2, first.y - 12, Colors.alpha(0xFF8B94A5, a * ha), false);
		for (int i = 0; i < SERVERS.length; i++) {
			XButton b = serverButtons[i];
			float se = ease(b.delay, 0.45f);
			if (se <= 0) continue;
			g.push();
			g.translate(b.enterX * (1 - se), 0);
			float sa = a * se;
			int col = (int) Long.parseLong(SERVERS[i][3], 16);
			g.pill(b.x + 4, b.y + 4, 14, 14, Colors.alpha(col, sa));
			g.text(SERVERS[i][2], b.x + 4 + (14 - g.font.width(SERVERS[i][2])) / 2 + 1, b.y + 7, Colors.alpha(0xFFFFFFFF, sa), false);
			g.text(SERVERS[i][0], b.x + 24, b.y + 3, Colors.alpha(0xFFFFFFFF, sa), false);
			g.text(SERVERS[i][1], b.x + 24, b.y + 12, Colors.alpha(0xFF8B94A5, sa), false);
			g.pop();
		}

		// Account chip, left of the tool icons
		int chipW = g.font.width(name) + 30;
		int chipX = width - 10 - 20 * 3 - 4 * 2 - 6 - chipW;
		g.pill(chipX, 8, chipW, 20, Colors.alpha(Colors.GLASS, a));
		g.pillOutline(chipX, 8, chipW, 20, Colors.alpha(0x1FFFFFFF, a));
		SkinView.head(g, Ids.skinOf(null), chipX + 5, 12, 12, Colors.alpha(0xFFFFFFFF, a));
		g.text(name, chipX + 22, 14, Colors.alpha(0xFFFFFFFF, a), false);

		String ver = "Xion " + XionClient.VERSION + "  ·  Minecraft " + Compat.MC_VERSION;
		g.text(ver, width - 14 - g.font.width(ver), height - 14, Colors.alpha(0xFF566070, a), false);

		// Tooltips last so they sit on top
		for (XButton b : buttons) {
			if (b.tooltip != null && b.contains(mx, my)) {
				int tw = g.font.width(b.tooltip) + 12;
				int tx = Math.min(mx + 8, width - tw - 2);
				g.pill(tx, my + 10, tw, 16, 0xF00C0F15);
				g.text(b.tooltip, tx + 6, my + 14, 0xFFFFFFFF, false);
			}
		}
	}

	@Override
	public boolean shouldCloseOnEsc() {
		return false;
	}
}
