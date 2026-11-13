//go:build !windows

package main

import (
	"fmt"
	"os"
)

func showError(s string) { fmt.Fprintln(os.Stderr, s) }
func runWindow(a *app, profile, url string) error {
	return fmt.Errorf("Windows 10/11 x64 앱입니다.")
}
