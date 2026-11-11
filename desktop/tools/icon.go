// Generate the app's simple four-page grid icon using the standard library.
package main

import (
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"os"
)

func main() {
	img := image.NewRGBA(image.Rect(0, 0, 256, 256))
	draw.Draw(img, img.Bounds(), &image.Uniform{color.RGBA{32, 37, 43, 255}}, image.Point{}, draw.Src)
	for _, r := range []image.Rectangle{image.Rect(38, 28, 116, 120), image.Rect(140, 28, 218, 120), image.Rect(38, 144, 116, 236), image.Rect(140, 144, 218, 236)} {
		draw.Draw(img, r, &image.Uniform{color.RGBA{199, 244, 129, 255}}, image.Point{}, draw.Src)
		for y := r.Min.Y + 24; y < r.Max.Y-12; y += 16 {
			draw.Draw(img, image.Rect(r.Min.X+14, y, r.Max.X-14, y+5), &image.Uniform{color.RGBA{60, 87, 42, 255}}, image.Point{}, draw.Src)
		}
	}
	f, err := os.Create("icon.png")
	if err != nil {
		panic(err)
	}
	defer f.Close()
	if err := png.Encode(f, img); err != nil {
		panic(err)
	}
}
