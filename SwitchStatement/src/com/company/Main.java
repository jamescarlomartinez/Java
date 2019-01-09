package com.company;

public class Main {

    public static void main(String[] args) {

        char grade = 'a';

        switch (grade) {
            case 'a':
                System.out.println("Perfect!");
                break;

            case 'b':
                System.out.println("that's B");
                break;

            case 'c':
                System.out.println("that's C");
                break;

            case 'd':
                System.out.println("that's D");
                break;

            case 'e':
                System.out.println("that's E");
                break;

            default:
                System.out.println("invalid grade");
        }
        System.out.println("your grade is " + grade);

    }
}
