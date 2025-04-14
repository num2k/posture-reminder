// HTML 미니파이 스크립트
import { minify } from "html-minifier-terser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 미니파이 설정
const minifyOptions = {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  minifyCSS: true,
  minifyJS: true,
};

// HTML 파일 목록
const htmlFiles = ["popup/popup.html", "popup/stretching_guide.html"];

async function minifyHtmlFiles() {
  try {
    for (const file of htmlFiles) {
      const sourcePath = path.join(__dirname, "packages", file);
      const targetPath = path.join(__dirname, "dist", file);

      console.log(`미니파이: ${sourcePath}`);

      const content = fs.readFileSync(sourcePath, "utf8");
      const minified = await minify(content, minifyOptions);

      // 기존 파일 백업
      if (fs.existsSync(targetPath)) {
        const backupPath = `${targetPath}.bak`;
        fs.copyFileSync(targetPath, backupPath);
      }

      fs.writeFileSync(targetPath, minified);

      const originalSize = content.length;
      const minifiedSize = minified.length;
      const savings = originalSize - minifiedSize;
      const percentage = ((savings / originalSize) * 100).toFixed(1);

      console.log(
        `최적화 완료: ${file} (${originalSize} → ${minifiedSize} 바이트, ${percentage}% 감소)`
      );
    }

    console.log("HTML 파일 미니파이 완료!");
  } catch (error) {
    console.error("HTML 미니파이 오류:", error);
    process.exit(1);
  }
}

minifyHtmlFiles();
