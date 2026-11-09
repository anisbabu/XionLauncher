package net.xion.client.mixin;

//#if MC >= 11900
import net.minecraft.client.OptionInstance;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

/** Lets Fullbright set gamma beyond the slider's 0–1 range. */
@Mixin(OptionInstance.class)
public interface OptionInstanceAccessor<T> {
	@Accessor("value")
	void xion$setValue(T value);
}
//#else
public interface OptionInstanceAccessor {}
//#endif
