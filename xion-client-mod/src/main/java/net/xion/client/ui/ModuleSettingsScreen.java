package net.xion.client.ui;

import net.minecraft.client.gui.screens.Screen;
import net.xion.client.XionConfig;
import net.xion.client.compat.BaseScreen;
import net.xion.client.compat.Colors;
import net.xion.client.compat.Compat;
import net.xion.client.compat.Gfx;
import net.xion.client.feature.Crosshair;
import net.xion.client.feature.Premium;
import net.xion.client.hud.HudModule;

/** Settings for one HUD module: on/off, size, background and colour (custom colours + chroma are Premium). */
public class ModuleSettingsScreen extends BaseScreen {
	private static final int SW = 14, SGAP = 4;
	private final Screen parent;
	private final HudModule module;
	private int px, py, pw, ph, swX, swY;
	private XButton enabledBtn, bgBtn, chromaBtn, sizeLabel;

	public ModuleSettingsScreen(Screen parent, HudModule module) {
		super(module.name);
		this.parent = parent;
		this.module = module;
	}

	@Override
	protected void layout() {
		pw = Math.min(width - 24, 260);
		ph = 196;
		px = (width - pw) / 2;
		py = (height - ph) / 2;
		int x = px + 14, w = pw - 28, y = py + 74;
		XionConfig.ModuleState s = module.state();
		enabledBtn = add(new XButton(x, y, w / 2 - 3, 18, "", XButton.Style.SLAB, () -> {
			s.enabled = !s.enabled;
			refresh();
		}));
		bgBtn = add(new XButton(x + w / 2 + 3, y, w / 2 - 3, 18, "", XButton.Style.SLAB, () -> {
			s.background = !s.background;
			refresh();
		}));
		y += 24;
		add(new XButton(x, y, 22, 18, "-", XButton.Style.SLAB, () -> resize(-0.1f)));
		sizeLabel = add(new XButton(x + 26, y, w - 52, 18, "", XButton.Style.TEXT, () -> {
			s.scale = 1f;
			refresh();
		}));
		add(new XButton(x + w - 22, y, 22, 18, "+", XButton.Style.SLAB, () -> resize(0.1f)));
		y += 30;
		swX = x;
		swY = y;
		y += SW + 8;
		chromaBtn = add(new XButton(x, y, w, 18, "", XButton.Style.SLAB, () -> {
			if (!Premium.active()) return;
			s.chroma = !s.chroma;
			refresh();
		}));
		add(new XButton(x, py + ph - 26, w / 2 - 3, 18, "Reset", XButton.Style.TEXT, () -> {
			s.scale = 1f;
			s.background = true;
			s.chroma = false;
			s.color = Colors.TEXT;
			refresh();
		}));
		add(new XButton(x + w / 2 + 3, py + ph - 26, w / 2 - 3, 18, "Done", XButton.Style.PRIMARY, this::onClose));
		refresh();
	}

	private void resize(float d) {
		XionConfig.ModuleState s = module.state();
		s.scale = Math.max(0.5f, Math.min(2f, Math.round((module.scale() + d) * 10) / 10f));
		refresh();
	}

	private void refresh() {
		XionConfig.ModuleState s = module.state();
		enabledBtn.label = s.enabled ? "Shown" : "Hidden";
		bgBtn.label = s.background ? "Background on" : "Background off";
		sizeLabel.label = "Size " + Math.round(module.scale() * 100) + "%";
		chromaBtn.label = Premium.active() ? (s.chroma ? "Chroma: on" : "Chroma: off") : "Chroma  ·  Xion+";
	}

	/** Swatch 0 = default text, 1 = theme accent (free); the rest are Premium. */
	private int swatch(int i) {
		return i == 0 ? Colors.TEXT : i == 1 ? Colors.ACCENT : Crosshair.SWATCHES[i];
	}

	@Override
	protected void draw(Gfx g, int mx, int my, float pt) {
		float a = intro(0.3f);
		panorama(g);
		g.fill(0, 0, width, height, Colors.alpha(0x8006080C, a));
		float s = 0.94f + 0.06f * ease(0f, 0.35f);
		g.push();
		g.translate(width / 2f * (1 - s), height / 2f * (1 - s));
		g.scale(s);
		g.pill(px, py, pw, ph, Colors.alpha(Colors.PANEL, a));
		g.pillOutline(px, py, pw, ph, Colors.alpha(0x22FFFFFF, a));
		g.text(module.name, px + 14, py + 12, Colors.alpha(Colors.TEXT, a), false);
		g.text(module.premium ? "Pro module" : "HUD module", px + 14, py + 23, Colors.alpha(module.premium ? Colors.GOLD : Colors.MUTED, a), false);

		// Live preview of the module itself
		int pvW = module.scaledWidth(minecraft), pvH = module.scaledHeight(minecraft);
		int pvX = px + (pw - pvW) / 2, pvY = py + 36 + (32 - pvH) / 2;
		g.push();
		g.translate(pvX, Math.max(py + 34, pvY));
		g.scale(Math.min(module.scale(), 30f / Math.max(1, module.height(minecraft))));
		module.render(g, minecraft, true);
		g.pop();

		drawButtons(g, mx, my, a);

		g.text("Text colour", swX, swY - 11, Colors.alpha(Colors.MUTED, a), false);
		XionConfig.ModuleState st = module.state();
		for (int i = 0; i < Crosshair.SWATCHES.length; i++) {
			int x = swX + i * (SW + SGAP);
			boolean locked = i > 1 && !Premium.active();
			int c = swatch(i);
			boolean sel = !st.chroma && st.color == c;
			if (sel) g.pillOutline(x - 2, swY - 2, SW + 4, SW + 4, Colors.alpha(0xFFFFFFFF, a));
			g.pill(x, swY, SW, SW, Colors.alpha(c, a * (locked ? 0.35f : 1f)));
			if (locked) g.fill(x + 5, swY + 6, x + 9, swY + 9, Colors.alpha(0xFF0B0D12, a));
		}
		if (!Premium.active()) {
			String hint = "Custom colours & chroma: Xion Premium";
			g.text(hint, px + (pw - g.font.width(hint)) / 2, py + ph - 42, Colors.alpha(Colors.GOLD, a), false);
		}
		g.pop();
	}

	@Override
	protected boolean click(double x, double y, int button) {
		if (y < swY || y > swY + SW) return false;
		int i = (int) ((x - swX) / (SW + SGAP));
		if (i < 0 || i >= Crosshair.SWATCHES.length || x - swX - i * (SW + SGAP) > SW) return false;
		if (i > 1 && !Premium.active()) return true;
		XionConfig.ModuleState s = module.state();
		s.color = swatch(i);
		s.chroma = false;
		Compat.click();
		refresh();
		return true;
	}

	@Override
	public void onClose() {
		XionConfig.save();
		Compat.setScreen(parent);
	}
}
