package fs

import (
	"context"
	"errors"
	"imcrypt_v3/backend/file"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Prompts the user to select a file
func OpenFileDialog(ctx context.Context, title string, filters []runtime.FileFilter) (string, error) {
	absolutePath, err := runtime.OpenFileDialog(ctx, runtime.OpenDialogOptions{
		Title:   title,
		Filters: filters,
	})
	if err != nil {
		if err.Error() == "shellItem is nil" {
			return "", errors.New("user cancelled the selection")
		}

		return "", err
	}

	return absolutePath, nil
}

// Opens a file at the given path and converts it into a custom File struct
func OpenFile(path string) (*file.File, error) {
	f, err := os.OpenFile(path, os.O_RDWR, 0700)
	if err != nil {
		return nil, err
	}

	return &file.File{File: f, Path: path}, nil
}
