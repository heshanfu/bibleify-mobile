//@flow
import React, { Component } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  Image,
  Clipboard,
  Share,
  NativeModules,
  findNodeHandle,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  BackHandler
} from "react-native";
const Realm = require("realm");
import DrawerLayout from "react-native-drawer-layout";
import Books from "../../constants/Books";
import GestureRecognizer, {
  swipeDirections
} from "react-native-swipe-gestures";
import Icon from "react-native-vector-icons/Ionicons";
import Video from "react-native-video";
import { SOUNDCLOUD_CLIENT_ID } from "../../constants/constants";
import { bookNameHelper } from "../../helpers";

import MusicControl from "react-native-music-control";
import MediaPlayerControl from "../../components/MediaPlayerControl";
import SelectedVerseToolBar from "../../components/SelectedVerseToolBar";
import MainToolBar from "../../components/MainToolBar";
import DrawerMenu from "../../components/DrawerMenu";


UIManager.setLayoutAnimationEnabledExperimental &&
  UIManager.setLayoutAnimationEnabledExperimental(true);

const RCTUIManager = require("NativeModules").UIManager;

const PassageSchema = {
  name: "Passage",
  primaryKey: "id",
  properties: {
    id: "string",
    content: "string",
    book: "string",
    chapter: "int",
    verse: "int",
    type: "string"
  }
};

class PassageScreen extends Component {
  _drawer;
  _scrollView;
  state = {
    verses: [],
    activeBook: Books[0],
    activeChapter: 1,
    activeVerse: 1,
    jumpText: "",
    selectedVerses: [],
    streamUrl: null,
    streamChapter: null,
    isLoadingSound: true,
    paused: false,
    streamDuration: 0,
    streamCurrentTime: 0
  };

  componentDidUpdate(prevProps, prevState) {
    if (
      this.state.activeBook != prevState.activeBook ||
      this.state.activeChapter != prevState.activeChapter ||
      this.state.activeVerse != prevState.activeVerse
    ) {
      this.loadPassage(() => {
        setTimeout(() => {
          if (this.state.activeVerse != prevState.activeVerse) {
            this.refs[
              `verse${this.state.activeVerse}`
            ].measureLayout(
              findNodeHandle(this._scrollView),
              (ox, oy, width, height, px, py) => {
                this._scrollView.scrollTo({
                  x: 0,
                  y: oy,
                  animated: true
                });
              }
              );
            this.setState({
              selectedVerses: [this.state.activeVerse]
            });
          }
        }, 200);
      });
    }
  }

  loadPassage(callback) {
    Realm.open({ schema: [PassageSchema], readOnly: true }).then(realm => {
      const { activeBook, activeChapter, activeVerse } = this.state;
      let passages = realm.objects("Passage");
      let filteredPassages = passages.filtered(
        `book = "${activeBook.value}" AND chapter = "${activeChapter}"`
      );
      const versesRaw = Object.keys(filteredPassages);
      if (versesRaw.length) {
        const verses = versesRaw.map(key => filteredPassages[key]);
        this.setState(
          {
            verses: verses
          },
          () => {
            callback && callback();
          }
        );
      }
    });
  }

  componentWillReceiveProps(nextProps) {
    const { jumpPassage } = nextProps;
    if (this.props.jumpPassage != jumpPassage && jumpPassage) {
      const activeBook = Books.filter(
        book => book.value == jumpPassage.book
      )[0];
      if (activeBook) {
        this.setState({
          activeBook,
          activeChapter: jumpPassage.chapter,
          activeVerse: jumpPassage.verse
        });
      }
    }
  }

  componentDidMount() {
    BackHandler.addEventListener("hardwareBackPress", () => {
      if (this.state.selectedVerses.length) {
        this.setState({
          selectedVerses: []
        });
        return true;
      }
      return false;
    });
    setTimeout(() => {
      this.loadPassage();
    }, 100);
  }

  _changeActiveBook(book) {
    this.setState({
      activeBook: book
    });
  }

  _changeActiveChapter(chapter) {
    console.log("aaaA", chapter)
    this.setState(
      {
        activeChapter: chapter
      },
      () => {
        this._drawer.closeDrawer();
      }
    );
  }

  _onSwipeLeft(gestureState) {
    console.log(gestureState);
    if (Math.abs(gestureState.dx) > 90) {
      const nextChapter = this.state.activeChapter + 1;
      if (nextChapter <= this.state.activeBook.total) {
        this.setState({
          activeChapter: nextChapter,
          selectedVerses: []
        });
        setTimeout(() => {
          this._scrollView.scrollTo({ x: 0, y: 0, animated: true });
        });
      }
    }
  }

  _onSwipeRight(gestureState) {
    console.log(gestureState);
    if (Math.abs(gestureState.dx) > 90) {
      const prevChapter = this.state.activeChapter - 1;
      if (prevChapter > 0) {
        this.setState({
          activeChapter: prevChapter,
          selectedVerses: []
        });
        setTimeout(() => {
          this._scrollView.scrollTo({ x: 0, y: 0, animated: true });
        });
      }
    }
  }

  _onJumpText(jumpText) {
    this.setState({ jumpText });
  }

  _onSubmitJump() {
    let jumpText = this.state.jumpText;
    if (jumpText.indexOf(" ") != -1) {
      let currentVerse = 1;
      if (jumpText.indexOf(":") != -1) {
        const splitVerse = jumpText.split(":");
        currentVerse = parseInt(splitVerse[1]);
        jumpText = splitVerse[0];
      }
      const splitChapter = jumpText.replace("  ", " ").split(" ");
      const activeBook = Books.filter(
        book =>
          book.name_id.toLowerCase().indexOf(splitChapter[0].toLowerCase()) !=
          -1
      )[0];
      const currentChapter = parseInt(splitChapter[1]);
      if (activeBook) {
        this.setState({
          activeBook: activeBook,
          activeChapter: currentChapter,
          activeVerse: currentVerse
        });
        this._drawer.closeDrawer();
      }
    }
  }

  _onClearJump() {
    this.setState({
      jumpText: ""
    });
  }

  _renderDrawer() {
    const { jumpText, activeBook, activeChapter } = this.state;
    return (
      <DrawerMenu
        jumpText={jumpText}
        _onSubmitJump={()=>this._onSubmitJump()} 
        _onJumpText={(jumpText)=>this._onJumpText(jumpText)}
        _onClearJump={()=>this._onClearJump()}
        _changeActiveBook={(book)=>this._changeActiveBook(book)}
        _changeActiveChapter={(chapter)=>this._changeActiveChapter(chapter)}
        activeBook={activeBook}
        activeChapter={activeChapter}/>
    );
  }

  _openDrawer() {
    this._drawer.openDrawer();
  }

  _onShowSearch() {
    this.props.onShowSearch && this.props.onShowSearch();
  }

  _onPlayStreaming() {
    const { activeBook, activeChapter } = this.state;
    const url = `https://api.soundcloud.com/playlists/${activeBook.playlistId}?client_id=${SOUNDCLOUD_CLIENT_ID}&limit=150&offset=0`;
    console.log(url);

    fetch(url)
      .then(res => res.json())
      .then(result => {
        const data = result.tracks.map(item => ({
          stream: item.stream_url,
          title: item.title,
          permalink: item.permalink
        }));
        let bookName = bookNameHelper(activeBook.name_id);
        const streamSong = data.filter(item => {
          return (
            item.title.toUpperCase().endsWith(`${bookName}${activeChapter}`) ||
            item.title.toUpperCase().endsWith(`${bookName}0${activeChapter}`)
          );
        })[0];
        if (streamSong) {
          console.log("SOOOONG", streamSong)
          LayoutAnimation.easeInEaseOut();
          if (this.state.streamUrl) {
            this.setState(
              {
                streamUrl: null,
                streamChapter: null,
                streamDuration: 0,
                streamCurrentTime: 0
              },
              () => {
                setTimeout(() => {
                  const streamUrl = `${streamSong.stream}?client_id=${SOUNDCLOUD_CLIENT_ID}`;
                  this.setState({
                    streamUrl,
                    streamChapter: {
                      activeBook,
                      activeChapter
                    },
                    isLoadingSound: true
                  });
                  console.log("PLAYING", streamUrl);
                }, 1000);
              }
            );
          } else {
            const streamUrl = `${streamSong.stream}?client_id=${SOUNDCLOUD_CLIENT_ID}`;
            this.setState({
              streamUrl,
              streamChapter: {
                activeBook,
                activeChapter
              },
              isLoadingSound: true
            });
            console.log("PLAYING", streamUrl);
          }
        }
      });
  }

  _onSelectVerse(verse) {
    const { selectedVerses } = this.state;
    if (selectedVerses.indexOf(verse) != -1) {
      this.setState({
        selectedVerses: selectedVerses.filter(item => item != verse)
      });
    } else {
      this.setState({
        selectedVerses: [...selectedVerses, verse]
      });
    }
  }

  _onBackToolbar() {
    this.setState({
      selectedVerses: []
    });
  }

  _onCopyVerse() {
    const { selectedVerses, verses } = this.state;

    const contentList = selectedVerses.map(item => {
      const currentVerse = verses.filter(current => current.verse == item)[0];
      if (!currentVerse) return "";
      return `${currentVerse.content} (${currentVerse.book} ${currentVerse.chapter}:${currentVerse.verse})\n`;
    });
    Clipboard.setString(contentList.join("\n"));
    this.setState({
      selectedVerses: []
    });
  }

  _onShareVerse() {
    const { selectedVerses, verses } = this.state;

    const contentList = selectedVerses.map(item => {
      const currentVerse = verses.filter(current => current.verse == item)[0];
      if (!currentVerse) return "";
      return `${currentVerse.content} (${currentVerse.book} ${currentVerse.chapter}:${currentVerse.verse})\n`;
    });
    const shareContent = contentList.join("\n");
    Share.share({
      message: shareContent,
      title: "Alkitab App",
      url: ""
    });
  }

  _renderToolbar() {
    const { verses, activeBook, activeChapter, selectedVerses } = this.state;
    if (selectedVerses.length) {
      return (
        <SelectedVerseToolBar
          _onBackToolbar={() => this._onBackToolbar()}
          _onCopyVerse={() => this._onCopyVerse()}
          _onShareVerse={() => this._onShareVerse()}
        />
      );
    } else {
      return (
        <MainToolBar
          _openDrawer={() => this._openDrawer()}
          _onShowSearch={() => this._onShowSearch()}
          _onPlayStreaming={() => this._onPlayStreaming()}
          activeBook={activeBook}
          activeChapter={activeChapter}
        />
      );
    }
  }
  
  onPlayProgress = ({ currentTime }) => {
    if (currentTime > 0 && this.state.isLoadingSound) {
      this.setState({
        isLoadingSound: false
      });
    }
    this.setState(
      {
        streamCurrentTime: currentTime
      },
      () => {
        MusicControl.updatePlayback({
          state: MusicControl.STATE_PLAYING,
          elapsedTime: currentTime
        });
      }
    );
    // console.log("PROGRESS", currentTime);
  };

  onPlayEnd = () => { };

  onLoad = data => {
    this.setState(
      {
        streamDuration: data.duration
      },
      () => {
        MusicControl.enableControl("seekForward", false);
        MusicControl.enableControl("seekBackward", false);
        MusicControl.enableControl("skipForward", false);
        MusicControl.enableControl("skipBackward", false);
        MusicControl.enableBackgroundMode(true);

        const { streamChapter } = this.state;

        MusicControl.setNowPlaying({
          title: `${streamChapter &&
          streamChapter.activeBook.name_id} ${streamChapter &&
          streamChapter.activeChapter}`,
          artist: "Alkitab Suara",
          duration: this.state.streamDuration,
          color: 0xfffffff
        });

        MusicControl.on("play", () => {
          this.setState({ paused: false });
        });
        MusicControl.on("pause", () => {
          this.setState({ paused: true });
        });
        MusicControl.on("nextTrack", () => { });
        MusicControl.on("previousTrack", () => { });

        MusicControl.updatePlayback({
          state: MusicControl.STATE_PLAYING
        });
      }
    );
  };

  onTogglePaused() {
    this.setState(
      {
        paused: !this.state.paused
      },
      () => {
        if (this.state.paused) {
          MusicControl.updatePlayback({
            state: MusicControl.STATE_PAUSED
          });
        } else {
          MusicControl.updatePlayback({
            state: MusicControl.STATE_PLAYING
          });
        }
      }
    );
  }

  onClosePlayer() {
    LayoutAnimation.easeInEaseOut();
    this.setState({
      streamUrl: null,
      streamChapter: null
    });
  }

  _renderPlayer() {
    const {
      streamUrl,
      streamChapter,
      paused,
      isLoadingSound,
      streamDuration,
      streamCurrentTime
    } = this.state;
    console.log("current", streamCurrentTime, "duration", streamDuration);
    const progress = streamCurrentTime / streamDuration * 100;
    console.log("PROGRESS", progress);
    return (
      <MediaPlayerControl
        streamUrl={streamUrl}
        streamChapter={streamChapter}
        paused={paused}
        isLoadingSound={isLoadingSound}
        streamDuration={streamDuration}
        streamCurrentTime={streamCurrentTime}
        progress={progress}
        onTogglePaused={() => this.onTogglePaused()}
        onClosePlayer={() => this.onClosePlayer()}
      />
    );
  }

  render() {
    const {
      verses,
      activeBook,
      activeChapter,
      streamUrl,
      streamChapter,
      paused,
      isLoadingSound
    } = this.state;
    const swipeConfig = {
      velocityThreshold: 0.3,
      directionalOffsetThreshold: 50
    };
    return (
      <DrawerLayout
        ref={drawer => {
          this._drawer = drawer;
        }}
        drawerWidth={300}
        drawerPosition={DrawerLayout.positions.Left}
        renderNavigationView={this._renderDrawer.bind(this)}
      >
        {this._renderToolbar()}
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.innerScroll,
            streamUrl ? { paddingBottom: 100 } : { paddingBottom: 20 }
          ]}
          ref={scrollView => (this._scrollView = scrollView)}
        >
          <GestureRecognizer
            onSwipeLeft={state => this._onSwipeLeft(state)}
            onSwipeRight={state => this._onSwipeRight(state)}
            config={swipeConfig}
          >
            {verses.map((verse, i) => {
              const isTitle = verse.type == "t";
              const { selectedVerses } = this.state;
              const isSelected = selectedVerses.indexOf(verse.verse) != -1;
              return (
                <View
                  key={i}
                  ref={"verse" + verse.verse}
                  style={[isSelected ? styles.selectedVerse : null]}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => this._onSelectVerse(verse.verse)}
                  >
                    <Text
                      style={[
                        styles.text,
                        isTitle ? styles.title : null,
                        isSelected ? styles.textSelected : null
                      ]}
                    >
                      {!isTitle ? (
                        <Text style={styles.verseNumber}>{verse.verse} </Text>
                      ) : null}
                      {verse.content}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </GestureRecognizer>
          {streamUrl ? (
            <Video
              source={{ uri: streamUrl }}
              ref="audio"
              volume={1.0}
              muted={false}
              paused={paused}
              playInBackground={true}
              playWhenInactive={true}
              onProgress={this.onPlayProgress}
              onEnd={this.onPlayEnd}
              onLoad={this.onLoad}
              resizeMode="cover"
              repeat={false}
            />
          ) : null}
        </ScrollView>
        {this._renderPlayer()}
      </DrawerLayout>
    );
  }
}

const styles = StyleSheet.create({
  toolbar: {
    paddingTop: Platform.OS == "ios" ? 20 : 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f364d",
    height: Platform.OS == "ios" ? 80 : 60
  },
  titleButton: {
    flex: 1,
    paddingHorizontal: 25
  },
  toolbarTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "300",
    backgroundColor: "transparent"
  },
  innerScroll: {
    paddingVertical: 15
  },
  actions: {
    flexDirection: "row",
    marginRight: 10
  },
  actionButton: {
    paddingHorizontal: 20
  },
  icon: {},
  container: {
    flex: 1,
    backgroundColor: "#0D233A"
  },
  text: {
    color: "#fff",
    lineHeight: 30,
    paddingHorizontal: 25
  },
  title: {
    fontWeight: "900"
  },
  verseNumber: {
    fontWeight: "900",
    paddingRight: 20,
    color: "#26405A",
    fontSize: 10
  },
  selectedVerse: {
    backgroundColor: "#fff"
  },
  textSelected: {
    color: "#1f364d"
  }
});

export default PassageScreen;