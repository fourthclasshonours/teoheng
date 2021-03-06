import Discord from 'discord.js';
import youtubeDlExec from 'youtube-dl-exec';

const GuildMap = new Map<string, App.GuildSession>();

const GuildManager = {
  client: new Discord.Client(),

  update() {
    const songs = [...GuildMap.values()]
      .filter((session) => session.currentItem != null)
      .map((session) => session.currentItem?.title);

    this.client.user?.setPresence?.({
      status: 'online',
      activity: {
        name: songs.join(', '),
        type: 'LISTENING',
      },
    });
  },

  init(guildId: string) {
    const session: App.GuildSession = {
      currentItem: null,
      queue: [],
      stream: null,
    };

    GuildMap.set(guildId, session);

    return session;
  },

  getSession(guildId: string) {
    const session = GuildMap.get(guildId);

    if (session == null) {
      throw new Error('no session for guild id');
    }

    return session;
  },

  addToQueue(guildId: string, items: App.QueueItem[]) {
    const { queue } = this.getSession(guildId);

    queue.push(...items);

    this.checkPlay(guildId);
  },

  checkPlay(guildId: string) {
    const session = GuildMap.get(guildId);

    if (session == null) {
      throw new Error('no session');
    }

    console.log('checkPlay', guildId, session);

    const { currentItem, queue } = session;
    if (currentItem != null) {
      // Something is playing
      return;
    } else if (queue.length === 0) {
      // Nothing to queue
      return;
    }

    const firstItem = queue[0];

    const updatedQueue = [...queue];
    updatedQueue.splice(0, 1);

    GuildMap.set(guildId, {
      ...session,
      currentItem: firstItem,
      queue: updatedQueue,
    });

    this.play(guildId, firstItem.id);
  },

  play: async function (guildId: string, videoId: string) {
    const connection = this.client?.voice?.connections?.get(guildId);

    if (connection == null) {
      throw new Error('no voice connection');
    }

    const session = GuildMap.get(guildId);

    if (session == null) {
      throw new Error('no session');
    }

    const response = await youtubeDlExec(
      `https://youtube.com/watch?v=${videoId}`,
      {
        dumpSingleJson: true,
        skipDownload: true,
        flatPlaylist: true,
        format: 'bestaudio',
      }
    );

    this.update();
    const stream = connection.play(response.url, {
      volume: 0.5,
      highWaterMark: 1 << 25,
    });

    GuildMap.set(guildId, {
      ...session,
      stream,
    });

    stream.on('finish', () => {
      const session = GuildMap.get(guildId);

      if (session == null) {
        throw new Error('no session');
      }

      GuildMap.set(guildId, {
        ...session,
        currentItem: null,
        stream: null,
      });

      this.checkPlay(guildId);
    });
  },
};

export default GuildManager;
