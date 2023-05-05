import { exec, spawn } from "child_process";
import { app } from "electron"; // tslint:disable-line:no-implicit-dependencies
import fs from "fs";
import process from "process";

import { JoysoundSongRawData } from "../main/joysoundApi";

export const TEMP_FOLDER: string = `${app.getPath("temp")}/karafriends_tmp`;
const youtubeIdRe: RegExp = new RegExp(/^[0-9A-Za-z_-]{10}[048AEIMQUYcgkosw]$/);
const nicoIdRe: RegExp = new RegExp(/^[sm]{2}\d*$/);
const captionCodeRe: RegExp = new RegExp(/^[a-z]{2}$/);

const extraResourcesPath: string =
  process.env.NODE_ENV === "development"
    ? `${app.getAppPath()}/extraResources/`
    : `${process.resourcesPath}/extraResources/`;

interface YtdlResourcePaths {
  // Path to the directory containing the ffmpeg executable
  ffmpeg: string;
  // Path to the ytdlp executable
  ytdlp: string;
}

const linuxResourcePaths: YtdlResourcePaths = {
  ffmpeg: `${extraResourcesPath}ffmpeg/linux/`,
  ytdlp: `${extraResourcesPath}/ytdlp/yt-dlp`,
};

const macosResourcePaths: YtdlResourcePaths = {
  ffmpeg: `${extraResourcesPath}ffmpeg/macos/`,
  ytdlp: `${extraResourcesPath}ytdlp/yt-dlp_macos`,
};

const winResourcePaths: YtdlResourcePaths = {
  ffmpeg: `${extraResourcesPath}ffmpeg/win/`,
  ytdlp: `${extraResourcesPath}ytdlp/yt-dlp.exe`,
};

const resourcePaths: YtdlResourcePaths =
  process.platform === "win32"
    ? winResourcePaths
    : process.platform === "darwin"
    ? macosResourcePaths
    : linuxResourcePaths;

export function downloadDamVideo(
  m3u8Url: string,
  songId: string,
  suffix: string
): void {
  if (!fs.existsSync(TEMP_FOLDER)) {
    fs.mkdirSync(TEMP_FOLDER);
  }

  const filename = `${TEMP_FOLDER}/${songId}-${suffix}.mp4`;
  const tempFilename = `${filename}.tmp`;

  if (fs.existsSync(filename)) {
    console.info(`${filename} already exists, not redownloading`);
    return;
  }

  console.info(`Downloading DAM video to ${filename}`);
  const ffmpegFilename: string =
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

  const ffmpeg = spawn(
    `${resourcePaths.ffmpeg}/${ffmpegFilename} -y -i "${m3u8Url}" -c copy -movflags faststart -f mp4 "${tempFilename}"`,
    { shell: true, stdio: "inherit" }
  );

  ffmpeg.on("exit", (code, signal) => {
    if (code === 0) {
      fs.renameSync(tempFilename, filename);
    } else {
      console.error(
        `Error downloading DAM video with ID ${songId}: code=${code}, signal=${signal}`
      );
    }
  });
}

export function downloadJoysoundData(
  url: string,
  songId: string,
  songDataPromise: Promise<JoysoundSongRawData>,
  onComplete: () => any
): void {
  if (!fs.existsSync(TEMP_FOLDER)) {
    fs.mkdirSync(TEMP_FOLDER);
  }

  const ffmpegFilename: string =
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

  const telopFilename = `${TEMP_FOLDER}/joysound-${songId}.joy_02`;
  const oggFilename = `${TEMP_FOLDER}/joysound-${songId}.ogg`;
  const videoFilename = `${TEMP_FOLDER}/joysound-${songId}.mp4`;

  const tempFilename = `${videoFilename}.tmp`;

  if (fs.existsSync(videoFilename)) {
    console.info(`${videoFilename} already exists, not redownloading`);
    onComplete();

    return;
  } else if (fs.existsSync(tempFilename)) {
    console.error(`${videoFilename} was already queued, not redownloading`);
    return;
  }

  fs.closeSync(fs.openSync(tempFilename, "w"));

  const ffmpegPromise = new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      `${resourcePaths.ffmpeg}/${ffmpegFilename} -y -i "${url}" -c copy -movflags faststart -f mp4 "${tempFilename}"`,
      { shell: true, stdio: "inherit" }
    );

    ffmpeg.on("exit", (code, signal) => {
      if (code === 0) {
        resolve(code);
      } else {
        console.error(
          `Error downloading Joysound video with ID ${songId}: url=${url}, code=${code}, signal=${signal}`
        );

        reject(code);
      }
    });
  });

  console.info(`Downloading Joysound video to ${videoFilename}`);

  Promise.all([ffmpegPromise, songDataPromise]).then((values) => {
    console.log("promise fulfilled");

    const joysoundSongRawData = values[1];

    const telopBase64 = joysoundSongRawData.telop;
    const oggBase64 = joysoundSongRawData.ogg;

    const telopBuffer = Buffer.from(
      telopBase64.slice(30) + telopBase64.slice(0, 30),
      "base64"
    );
    const oggBuffer = Buffer.from(
      oggBase64.slice(30) + oggBase64.slice(0, 30),
      "base64"
    );

    fs.writeFileSync(telopFilename, telopBuffer);
    fs.writeFileSync(oggFilename, oggBuffer);

    const ffmpeg = spawn(
      `${resourcePaths.ffmpeg}/${ffmpegFilename} -y -stream_loop -1 -i "${tempFilename}" -i "${oggFilename}" -c copy -shortest -movflags faststart -f mp4 "${videoFilename}"`,
      { shell: true, stdio: "inherit" }
    );

    ffmpeg.on("exit", (code, signal) => {
      if (code === 0) {
        fs.unlinkSync(tempFilename);
        onComplete();
      } else {
        console.error(
          `Error downloading Joysound video with ID ${songId}: url=${url}, code=${code}, signal=${signal}`
        );
      }
    });
  });
}

export function downloadYoutubeVideo(
  videoId: string,
  captionCode: string | null,
  onComplete: () => any
): void {
  // Make sure our inputs are valid. Don't want to pass just anything into a raw shell command
  if (!youtubeIdRe.test(videoId)) {
    console.error(
      `Error downloading Youtube Video. ${videoId} is not a valid YouTube video ID`
    );
    return;
  }
  if (captionCode !== null && !captionCodeRe.test(captionCode)) {
    console.error(
      `Error downloading Youtube Video. ${captionCode} is not a valid caption code`
    );
    return;
  }

  if (!fs.existsSync(TEMP_FOLDER)) {
    fs.mkdirSync(TEMP_FOLDER);
  }

  const writeBasePath = `${TEMP_FOLDER}/${videoId}`;
  console.info(`Downloading YouTube video to ${writeBasePath}.mp4`);

  const captionArgs = captionCode
    ? `--write-subs --sub-langs ${captionCode}`
    : "";
  const ytdlp = spawn(
    `${resourcePaths.ytdlp} ${captionArgs} -S res:720,ext:mp4:m4a --recode mp4 -N 4 --ffmpeg-location "${resourcePaths.ffmpeg}" -o "${writeBasePath}.mp4" -- "${videoId}"`,
    { shell: true, stdio: "inherit" }
  );

  ytdlp.on("exit", (code, signal) => {
    if (code !== 0) {
      console.error(
        `Error downloading Youtube Video with ID ${videoId}, see output for details`
      );
      return;
    }

    if (captionCode) {
      try {
        fs.renameSync(
          `${writeBasePath}.${captionCode}.vtt`,
          `${writeBasePath}.vtt`
        );
      } catch (fsError) {
        console.error(
          `Error trying to rename caption file ${writeBasePath}.${captionCode}.vtt to ${writeBasePath}.vtt: ${fsError}`
        );
      }
    }
    onComplete();
  });
}

export function downloadNicoVideo(
  videoId: string,
  onComplete: () => any
): void {
  // Make sure our inputs are valid. Don't want to pass just anything into a raw shell command
  if (!nicoIdRe.test(videoId)) {
    console.error(
      `Error downloading Niconico Video. ${videoId} is not a valid Niconico video ID`
    );
    return;
  }

  if (!fs.existsSync(TEMP_FOLDER)) {
    fs.mkdirSync(TEMP_FOLDER);
  }

  const writeBasePath = `${TEMP_FOLDER}/${videoId}`;
  console.info(`Downloading Niconico video to ${writeBasePath}.mp4`);

  exec(
    `${resourcePaths.ytdlp} -N 4 -o "${writeBasePath}.mp4" -- "https://www.nicovideo.jp/watch/${videoId}"`,
    (error, stdout, stderr) => {
      if (error) {
        console.error(
          `Error downloading Niconico Video with ID ${videoId}: ${error}`
        );
        return;
      }
      console.log(stdout);
      console.error(stderr);
      onComplete();
    }
  );
}
