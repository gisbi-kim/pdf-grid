package main

import (
	"fmt"
	"net/url"
	"strings"
)

func validateExternalURL(value string) error {
	if strings.ContainsAny(value, "\x00\r\n\t") {
		return fmt.Errorf("지원하지 않는 링크입니다.")
	}
	u, err := url.Parse(value)
	if err != nil {
		return fmt.Errorf("지원하지 않는 링크입니다.")
	}
	switch strings.ToLower(u.Scheme) {
	case "http", "https":
		if u.Hostname() != "" {
			return nil
		}
	case "mailto":
		if u.Opaque != "" || u.Path != "" {
			return nil
		}
	}
	return fmt.Errorf("웹 주소 또는 이메일 링크만 열 수 있습니다.")
}
