package net.xion.client.ui;

import net.minecraft.client.gui.screens.Screen;
import net.xion.client.XionClient;
import net.xion.client.XionConfig;
import net.xion.client.compat.BaseScreen;
import net.xion.client.compat.Colors;
import net.xion.client.compat.Compat;
import net.xion.client.compat.Gfx;
import net.xion.client.compat.Ids;
import net.xion.client.feature.Badge;
import net.xion.client.feature.Pvp;
import net.xion.client.hud.HudManager;
import net.xion.client.hud.HudModule;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/** Right Shift menu: mods (logos, on/off, config), HUD modules, features, cosmetics, Xion+ and your profile. */
public class XionMenuScreen extends BaseScreen {
	public enum Tab { MODS, HUD, FEATURES, COSMETICS, PREMIUM, PROFILE }

	private static final int GAP = 6;
	private static final int CARD_H = 34;

	private record Toggle(String name, String desc, BooleanSupplier get, Consumer<Boolean> set, HudModule module, boolean premium) {
		Toggle(String name, String desc, BooleanSupplier get, Consumer<Boolean> set) {
			this(name, desc, get, set, null, false);
		}
	}

	private final Screen parent;
	private final PremiumPanel premiumPanel = new PremiumPanel();
	private final CosmeticsPanel cosmeticsPanel = new CosmeticsPanel();
	private final ModsPanel modsPanel;
	private Tab tab;
	private int px, py, pw, ph, cols, cardW;
	private int contentX, contentY, contentW, contentH;
	private double scroll;
	private final List<Toggle> toggles = new ArrayList<>();

	public XionMenuScreen(Screen parent, Tab tab) {
		super("Xion Menu");
		this.parent = parent;
		this.tab = tab;
		for (HudModule m : HudManager.MODULES) {
			if (m.pvpOnly && !Pvp.active()) continue;
			toggles.add(new Toggle(m.name, m.description, () -> m.state().enabled, v -> m.state().enabled = v, m, m.premium));
		}
		modsPanel = new ModsPanel(ModConfigs.discover());
	}

	private List<Toggle> features() {
		List<Toggle> f = new ArrayList<>();
		f.add(new Toggle("Auto Sprint", "Always sprint when moving forward", () -> XionConfig.data.autoSprint, v -> XionConfig.data.autoSprint = v));
		f.add(new Toggle("Fullbright", "See clearly in the dark", () -> XionConfig.data.fullbright, v -> XionConfig.data.fullbright = v));
		f.add(new Toggle("HUD Background", "Dark boxes behind HUD text", () -> XionConfig.data.hudBackground, v -> XionConfig.data.hudBackground = v));
		f.add(new Toggle("Xion Badge", "Logo next to your name (tab, F5)", () -> XionConfig.data.badge, v -> XionConfig.data.badge = v));
		f.add(new Toggle("Custom Skin", "Use the skin from Xion Launcher", () -> XionConfig.data.customSkin, v -> XionConfig.data.customSkin = v));
		f.add(new Toggle("Xion Main Menu", "Replace the vanilla title screen", () -> XionConfig.data.customMenu, v -> XionConfig.data.customMenu = v));
		return f;
	}

	@Override
	protected void layout() {
		pw = Math.min(width - 16, 470);
		ph = Math.min(height - 16, 250);
		px = (width - pw) / 2;
		py = (height - ph) / 2;
		int sideW = 92;
		contentX = px + sideW + 10;
		contentY = py + 34;
		contentW = pw - sideW - 20;
		contentH = ph - 34 - 30;
		cols = contentW >= 330 ? 3 : 2;
		cardW = (contentW - (cols - 1) * GAP) / cols;

		Tab[] tabs = Tab.values();
		String[] names = Pvp.active()
			? new String[]{"Mods", "PvP HUD", "Combat", "Cosmetics", "Xion+", "Profile"}
			: new String[]{"Mods", "HUD Mods", "Features", "Cosmetics", "Xion+", "Profile"};
		for (int i = 0; i < tabs.length; i++) {
			Tab t = tabs[i];
			XButton b = add(new XButton(px + 8, py + 34 + i * 24, sideW - 8, 20, names[i], XButton.Style.TAB, () -> switchTab(t)));
			b.selected = t == tab;
		}
		int by = py + ph - 24;
		if (tab == Tab.HUD) add(new XButton(contentX, by, 120, 18, "Edit HUD Layout", XButton.Style.PRIMARY, () -> Compat.setScreen(new HudEditorScreen(this))));
		if (tab == Tab.PREMIUM) premiumPanel.layout(this::add, contentX, contentY, contentW);
		add(new XButton(px + pw - 10 - 64, by, 64, 18, "Done", XButton.Style.GLASS, this::onClose));
	}

	private void switchTab(Tab t) {
		tab = t;
		scroll = 0;
		if (t == Tab.MODS) modsPanel.restart();
		rebuild();
	}

	private void rebuild() {
		buttons.clear();
		layout();
	}

	private List<Toggle> currentToggles() {
		return tab == Tab.HUD ? toggles : tab == Tab.FEATURES ? features() : List.of();
	}

	private int rowsHeight() {
		if (tab == Tab.MODS) return modsPanel.height(contentW);
		if (tab == Tab.COSMETICS) return cosmeticsPanel.height(contentW);
		int n = currentToggles().size();
		return ((n + cols - 1) / cols) * (CARD_H + GAP);
	}

	@Override
	protected void draw(Gfx g, int mx, int my, float pt) {
		float a = intro(0.35f);
		panorama(g);
		g.fill(0, 0, width, height, Colors.alpha(0x8006080C, a));

		int oy = (int) ((1 - a) * 10);
		g.push();
		g.translate(0, oy);
		// Panel
		g.pill(px, py, pw, ph, Colors.alpha(Colors.PANEL, a));
		g.pillOutline(px, py, pw, ph, Colors.alpha(0x1FFFFFFF, a));

		g.blit(Ids.LOGO, px + 10, py + 9, 16, 16, 0, 0, 128, 128, 128, 128, Colors.alpha(0xFFFFFFFF, a));
		g.text("Xion", px + 32, py + 13, Colors.alpha(Colors.TEXT, a), false);
		g.text("Client " + XionClient.VERSION, px + 32 + g.font.width("Xion") + 6, py + 13, Colors.alpha(Colors.MUTED, a), false);
		if (Pvp.active()) {
			g.fill(px, py, px + pw, py + 2, Colors.alpha(Colors.ACCENT, a));
			int tx = px + 32 + g.font.width("Xion") + 6 + g.font.width("Client " + XionClient.VERSION) + 8;
			g.fill(tx, py + 10, tx + g.font.width("PVP") + 8, py + 22, Colors.alpha(Colors.ACCENT, a));
			g.text("PVP", tx + 4, py + 12, Colors.alpha(0xFF1A0709, a), false);
		}
		String hint = Pvp.active() ? HudManager.fps() + " FPS" : "Right Shift to open in game";
		g.text(hint, px + pw - 10 - g.font.width(hint), py + 14, Colors.alpha(Colors.MUTED, a), false);
		g.fill(px + 96, py + 32, px + 97, py + ph - 8, Colors.alpha(0x18FFFFFF, a));

		drawButtons(g, mx, my - oy, a);

		if (rowsHeight() > contentH) {
			// scrollbar
			int trackX = px + pw - 6;
			int barH = Math.max(12, contentH * contentH / rowsHeight());
			int barY = contentY + (int) ((contentH - barH) * (scroll / Math.max(1, rowsHeight() - contentH)));
			g.fill(trackX, contentY, trackX + 2, contentY + contentH, Colors.alpha(0x14FFFFFF, a));
			g.fill(trackX, barY, trackX + 2, barY + barH, Colors.alpha(Colors.ACCENT, a));
		}
		switch (tab) {
			case MODS -> {
				modsPanel.draw(g, contentX, contentY, contentW, contentH, scroll, mx, my - oy, a);
				modsPanel.footer(g, contentX, py + ph - 19, a);
			}
			case PROFILE -> drawProfile(g, mx, my - oy, a);
			case PREMIUM -> premiumPanel.draw(g, contentX, contentY, contentW, a);
			case COSMETICS -> cosmeticsPanel.draw(g, contentX, contentY, contentW, contentH, scroll, mx, my - oy, a);
			default -> drawToggles(g, mx, my - oy, a);
		}
		g.pop();
	}

	private void drawToggles(Gfx g, int mx, int my, float a) {
		List<Toggle> list = currentToggles();
		for (int i = 0; i < list.size(); i++) {
			Toggle tg = list.get(i);
			int x = contentX + (i % cols) * (cardW + GAP);
			int y = contentY + (i / cols) * (CARD_H + GAP) - (int) scroll;
			if (y < contentY - 1 || y + CARD_H > contentY + contentH + 1) continue;
			boolean on = tg.get().getAsBoolean();
			boolean hov = mx >= x && mx < x + cardW && my >= y && my < y + CARD_H;
			g.pill(x, y, cardW, CARD_H, Colors.alpha(hov ? Colors.CARD_HOVER : Colors.CARD, a));
			boolean locked = tg.premium() && !net.xion.client.feature.Premium.active();
			g.pillOutline(x, y, cardW, CARD_H, on && !locked ? Colors.alpha(Colors.ACCENT, 0.25f * a) : Colors.alpha(0x14FFFFFF, a));
			g.text(g.font.plainSubstrByWidth(tg.name(), cardW - 62), x + 7, y + 6, Colors.alpha(locked ? Colors.MUTED : Colors.TEXT, a), false);
			if (tg.premium()) g.text("XION+", x + cardW - 30 - g.font.width("XION+"), y + 6, Colors.alpha(Colors.GOLD, a), false);
			String sub = tg.module() != null && hov && mx < x + cardW - 30 && !locked ? "Settings ›" : tg.desc();
			g.text(g.font.plainSubstrByWidth(sub, cardW - 36), x + 7, y + 19, Colors.alpha(sub.equals("Settings ›") ? Colors.ACCENT : Colors.MUTED, a), false);
			if (locked) on = false;
			int sx = x + cardW - 26, sy = y + (CARD_H - 10) / 2;
			g.pill(sx, sy, 20, 10, Colors.alpha(on ? Colors.ACCENT : 0xFF2A303C, a));
			g.rounded(on ? sx + 11 : sx + 1, sy + 1, 8, 8, Colors.alpha(on ? Colors.ON_PILL : 0xFF8B94A5, a));
		}
	}

	private void drawProfile(Gfx g, int mx, int my, float a) {
		int cx = contentX + 46;
		int top = contentY + 4;
		// Animated glow pad behind the avatar
		float t = (float) ((Math.sin(System.currentTimeMillis() / 600.0) + 1) / 2);
		g.pill(cx - 40, top, 80, 132, Colors.alpha(Colors.CARD, a));
		g.pillOutline(cx - 40, top, 80, 132, Colors.alpha(Colors.lerp(0x24FFFFFF, 0x40C9D6FF, t), a));
		g.vGradient(cx - 38, top + 90, 76, 40, 0x00C9D6FF, Colors.alpha(0x22C9D6FF, a));
		int bob = (int) Math.round(Math.sin(System.currentTimeMillis() / 500.0) * 2);
		SkinView.body(g, Ids.skinOf(minecraft.player), cx - 16, top + 18 + bob, 2, Colors.alpha(0xFFFFFFFF, a));

		int ix = contentX + 104;
		String name = minecraft.getUser().getName();
		g.scaledText((XionConfig.data.badge ? Badge.glyph() + " " : "") + name, ix, top + 4, 1.5f, Colors.alpha(Colors.TEXT, a), true);
		boolean ms = "microsoft".equals(XionConfig.launcher.account);
		g.pill(ix, top + 22, ms ? 62 : 52, 12, Colors.alpha(ms ? 0xFF1D3B2E : 0xFF232937, a));
		g.text(ms ? "Microsoft" : "Offline", ix + 5, top + 24, Colors.alpha(ms ? Colors.OK : Colors.ACCENT, a), false);

		String[] lines = {
			"Skin: " + (net.xion.client.feature.SkinOverride.active() ? "custom (from Xion Launcher)" : "default"),
			"Badge: " + (XionConfig.data.badge ? "shown in tab list & F5" : "hidden"),
			"Minecraft " + Compat.MC_VERSION + "  ·  " + modsPanel.loadedCount() + " mods",
			"",
			"Change your skin in Xion Launcher",
			"→ Profile. Microsoft skins sync to",
			"everyone; offline skins show for you."
		};
		for (int i = 0; i < lines.length; i++) {
			g.text(lines[i], ix, top + 44 + i * 11, Colors.alpha(i >= 4 ? Colors.MUTED : Colors.TEXT, a), false);
		}
	}

	@Override
	protected boolean click(double x, double y, int button) {
		if (tab == Tab.PREMIUM) return premiumPanel.click(x, y, button);
		if (tab == Tab.COSMETICS) {
			CosmeticsPanel.Click c = cosmeticsPanel.click(x, y, contentX, contentY, contentW, contentH, scroll);
			if (c == CosmeticsPanel.Click.LOCKED) {
				tab = Tab.PREMIUM;
				scroll = 0;
				rebuild();
			}
			return c != CosmeticsPanel.Click.NONE;
		}
		if (tab == Tab.MODS) {
			ModsPanel.Click c = modsPanel.click(x, y, contentX, contentY, contentW, contentH, scroll, this);
			if (c == ModsPanel.Click.FILTER) scroll = 0;
			if (c == ModsPanel.Click.XION) switchTab(Tab.HUD);
			return c != ModsPanel.Click.NONE;
		}
		if (tab != Tab.HUD && tab != Tab.FEATURES) return false;
		List<Toggle> list = currentToggles();
		for (int i = 0; i < list.size(); i++) {
			int cxp = contentX + (i % cols) * (cardW + GAP);
			int cyp = contentY + (i / cols) * (CARD_H + GAP) - (int) scroll;
			if (x >= cxp && x < cxp + cardW && y >= cyp && y < cyp + CARD_H && cyp >= contentY - 4 && cyp < contentY + contentH) {
				Toggle tg = list.get(i);
				if (tg.premium() && !net.xion.client.feature.Premium.active()) {
					Compat.click();
					tab = Tab.PREMIUM;
					scroll = 0;
					rebuild();
					return true;
				}
				// The card body opens a module's settings; the switch on the right toggles it.
				if (tg.module() != null && (x < cxp + cardW - 30 || button == 1)) {
					Compat.click();
					Compat.setScreen(new ModuleSettingsScreen(this, tg.module()));
					return true;
				}
				tg.set().accept(!tg.get().getAsBoolean());
				XionConfig.save();
				Compat.click();
				return true;
			}
		}
		return false;
	}

	@Override
	protected void scroll(double x, double y, double amount) {
		double max = Math.max(0, rowsHeight() - contentH);
		scroll = Math.max(0, Math.min(max, scroll - amount * 18));
	}

	@Override
	public void onClose() {
		XionConfig.save();
		Compat.setScreen(parent);
	}
}
