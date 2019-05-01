import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Room} from '../../model/room';
import {User} from '../../model/user';
import {Story} from '../../model/story';
import {StompHandlerService} from '../../service/stomp-handler.service';
import {WebSocketChatMessage} from '../../model/webSocketChatMessage';

@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.css']
})
export class RoomComponent implements OnInit, OnDestroy {

  room: Room;
  currentUser: User;

  private sub: any;
  constructor(private route: ActivatedRoute, private stompHandler: StompHandlerService, private router: Router) { }

  ngOnInit() {
    this.sub = this.route.params.subscribe((param) => {
      this.room = new Room();
      this.currentUser = new User();
      this.room.currentStory = new Story();
      this.currentUser.name = param.userName;
      this.currentUser.id = this.generateUniqueId();
      this.room.id = param.roomId;
      this.stompHandler
        .initializeWebSocketConnection(this.room, this.currentUser, (webSocker: WebSocketChatMessage) => this.updateRoom(webSocker.room));
    });

  }

  private updateRoom(room: Room): void {
    this.room = room;
    this.checkIfAllUsersVotes(this.room.users);
    this.checkIfImConnected();
  }

  private checkIfImConnected(): void {
    if (!this.room.users.find(u => u.id === this.currentUser.id)) {
      this.stompHandler.disconnect();
      alert('You have been disconnected!');
      this.router.navigate(['/']);
    }
  }

  private checkIfAllUsersVotes(users: Array<User>): void {
    if (users != null) {
      const everyUserVoted = users.every((user) => !!user.vote || user.spectator);

      if (everyUserVoted && !this.room.showVotes) {
        this.showVotes(true);
      }
    }
  }


  vote(num: number) {
    this.currentUser.vote = num;
    let avergageVote = 0;
    this.synchronizeIterate((user) => {
      if (this.currentUser.id === user.id) {
        user.vote = num;
      }
      if (user.vote) {
        avergageVote += user.vote;
      }
    });

    avergageVote *=  this.room.users.length;
    this.room.currentStory.score = avergageVote;

    this.publish();
  }

  updateSpectator(): void {
    this.currentUser.spectator = !this.currentUser.spectator;
    this.synchronizeIterate((user) => {
      if (this.currentUser.id === user.id) {
        user.spectator = this.currentUser.spectator;
      }
    });
    this.publish();
  }

  showVotes(show: boolean) {
    this.room.showVotes = show;
    this.synchronizeIterate((user) => {
      if (this.currentUser.id === user.id) {
        this.room.showVotes = show;
      }
    });
    this.publish();
  }

  clearVotes() {

    this.synchronizeIterate((user) => {
      delete user.vote;
      this.showVotes(false);
    });

    if (!this.room.currentStory.id) {
      this.room.currentStory.id = this.generateUniqueId();
    }

    if (!this.room.currentStory.storyName) {
      this.room.currentStory.storyName = this.generateUniqueId();
    }

    if (this.room.stories == null) {
      this.room.stories = [];
    }

    this.room.stories.push(this.room.currentStory);
    this.room.currentStory = new Story();

    this.publish();
  }

  synchronizeIterate(action: (user: User) => void) {
    for (const user of this.room.users) {
      action(user);
    }
  }

  onKeySetStoryName(event): void {
    this.room.currentStory.storyName = event.target.value;
    this.publish();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  generateUniqueId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  deleteStory(id: string) {
    this.room.stories = this.room.stories.filter((str) => str.id !== id);
    this.publish();
  }

  getUrl(): string{
    return window.location.origin;
  }

  private publish(): void{
    this.stompHandler.publish(this.room, this.currentUser);

  }

  kickUser(id: string) {
    this.room.users = this.room.users.filter((u) => u.id !== id);
    this.publish();
  }
}
