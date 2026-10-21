/** Phones and tablets get the lighter visual/audio profile; the stage (a laptop) keeps everything. */
export const IS_LIGHT =
  typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768)
