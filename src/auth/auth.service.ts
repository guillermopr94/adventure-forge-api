import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OAuth2Client } from 'google-auth-library';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class AuthService {
    private googleClient: OAuth2Client;

    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {
        this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    }

    async verifyGoogleToken(token: string) {
        try {
            const ticket = await this.googleClient.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            if (!payload) throw new UnauthorizedException('Invalid token payload');
            return payload;
        } catch (error) {
            console.error('Google token verification failed', error);
            throw new UnauthorizedException('Invalid Google Token');
        }
    }

    async validateUser(token: string) {
        const payload = await this.verifyGoogleToken(token);

        // Find or create user
        let user = await this.userModel.findOne({ googleId: payload.sub });
        if (!user) {
            user = await this.userModel.create({
                email: payload.email,
                googleId: payload.sub,
                firstName: payload.given_name,
                lastName: payload.family_name,
                picture: payload.picture,
            });
        }
        return user;
    }
}
